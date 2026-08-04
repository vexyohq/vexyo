import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  connectStdio,
  readGoldenSet,
  recordGoldens,
  runRegression,
  stableStringify,
  writeGoldenSet,
  type GoldenConfig,
  type GoldenSet,
  type RegressionDetail,
  type RuleResult,
} from '../../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const fixture = resolve(repoRoot, 'fixtures/servers/broken/src/regression.ts');
const goldenDir = resolve(repoRoot, 'fixtures/goldens');

const cfg: GoldenConfig = {
  specVersion: '2025-11-25',
  defaultNormalizers: ['iso-timestamp', 'uuid'],
  defaultPaths: {},
  defaultSortArrays: [],
  defaultIgnore: [],
  tools: {
    echo: { cases: [{ case: 'basic', arguments: { text: 'hello' } }] },
    add: { cases: [{ case: 'basic', arguments: { a: 2, b: 3 } }] },
    stamp: { cases: [{ case: 'default', arguments: {} }] },
  },
};

/** `report` mixes volatile paths with stable fields — no whole-tree normalizers. */
const reportCfg: GoldenConfig = {
  specVersion: '2025-11-25',
  defaultNormalizers: [],
  defaultPaths: {},
  defaultSortArrays: [],
  defaultIgnore: [],
  tools: {
    report: {
      cases: [{ case: 'default', arguments: {} }],
      paths: { 'structuredContent.items[*].id': 'uuid' },
      ignore: ['meta.elapsedMs'],
    },
  },
};

/** `inventory` returns stable items in a random order — sortArrays absorbs it. */
const inventoryCfg: GoldenConfig = {
  specVersion: '2025-11-25',
  defaultNormalizers: [],
  defaultPaths: {},
  defaultSortArrays: [],
  defaultIgnore: [],
  tools: {
    inventory: {
      cases: [{ case: 'default', arguments: {} }],
      sortArrays: ['structuredContent.items'],
    },
  },
};

async function withClient<T>(
  defect: string,
  fn: (client: Parameters<typeof runRegression>[0]) => Promise<T>,
): Promise<T> {
  const conn = await connectStdio({
    command: process.execPath,
    args: ['--import', 'tsx', fixture, '--defect', defect],
    cwd: repoRoot,
  });
  try {
    return await fn(conn.client);
  } finally {
    await conn.close().catch(() => undefined);
  }
}

async function regress(defect: string): Promise<RuleResult[]> {
  const golden = await readGoldenSet(goldenDir);
  return withClient(defect, (client) => runRegression(client, golden, cfg));
}

/** The single drifting result, plus its typed detail. */
function soleDrift(results: RuleResult[]): { result: RuleResult; detail: RegressionDetail } {
  const drifting = results.filter((r) => r.status !== 'pass');
  expect(drifting.map((r) => r.ruleId)).toHaveLength(1);
  const result = drifting[0];
  if (!result) {
    throw new Error('expected exactly one drifting result');
  }
  return { result, detail: result.findings[0]?.detail as RegressionDetail };
}

describe('regression drift detection (fixture pairs)', () => {
  it('baseline: no drift, every result passes', async () => {
    const results = await regress('none');
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('behavioral drift: changed tool output fails (error)', async () => {
    const { result, detail } = soleDrift(await regress('tool-output-changed'));
    expect(detail.kind).toBe('behavioral');
    expect(result.status).toBe('fail');
    expect(result.ruleId).toContain('echo');
  });

  it('schema drift: changed tool definition fails (error)', async () => {
    const { result, detail } = soleDrift(await regress('tool-schema-changed'));
    expect(detail.kind).toBe('schema');
    expect(result.status).toBe('fail');
    expect(detail.fieldDiffs?.[0]?.path).toContain('text');
  });

  it('coverage drift: removed tool fails (error)', async () => {
    const { result, detail } = soleDrift(await regress('tool-removed'));
    expect(detail.kind).toBe('coverage');
    expect(detail.change).toBe('removed');
    expect(result.status).toBe('fail');
  });

  it('coverage drift: added tool warns (does not fail)', async () => {
    const { result, detail } = soleDrift(await regress('tool-added'));
    expect(detail.kind).toBe('coverage');
    expect(detail.change).toBe('added');
    expect(result.status).toBe('warn');
  });
});

describe('path-scoped normalizers and ignored paths', () => {
  async function recordWith(config: GoldenConfig): Promise<GoldenSet> {
    return withClient('none', (client) => recordGoldens(client, config));
  }

  it('no false drift across processes: volatile paths normalized, ignored path skipped', async () => {
    const golden = await recordWith(reportCfg);
    // Fresh server process → new uuids and a new elapsedMs on every call.
    const results = await withClient('none', (client) => runRegression(client, golden, reportCfg));
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
  });

  it('the golden itself carries the placeholder, not the volatile values', async () => {
    const golden = await recordWith(reportCfg);
    const recorded = stableStringify(golden.recordings);
    expect(recorded).toContain('<uuid>');
    expect(recorded).toContain('<ignored>');
    expect(recorded).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // no raw uuid survived
  });

  it('real drift on a non-normalized field is still caught, at the right path', async () => {
    const golden = await recordWith(reportCfg);
    const { result, detail } = soleDrift(
      await withClient('report-output-changed', (client) =>
        runRegression(client, golden, reportCfg),
      ),
    );
    expect(detail.kind).toBe('behavioral');
    expect(result.status).toBe('fail');
    const paths = detail.fieldDiffs?.map((d) => d.path) ?? [];
    expect(paths).toContain('structuredContent.summary');
    expect(paths.every((p) => !p.includes('items') && !p.includes('elapsedMs'))).toBe(true);
  });

  it('rules added AFTER recording apply without a re-record (both sides pipelined)', async () => {
    // Record with NO rules: the golden holds raw uuids and a raw elapsedMs.
    const rawCfg: GoldenConfig = {
      ...reportCfg,
      tools: { report: { cases: [{ case: 'default', arguments: {} }] } },
    };
    const golden = await recordWith(rawCfg);
    // Regress with the rules present — old golden, new config, no drift.
    const results = await withClient('none', (client) => runRegression(client, golden, reportCfg));
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
  });

  it('a config without the new options records byte-identical goldens (backward compat)', async () => {
    const golden = await recordWith(cfg);
    const dir = await mkdtemp(join(tmpdir(), 'mcph-bytes-'));
    await writeGoldenSet(dir, golden);
    for (const file of [
      'manifest.json',
      'recordings/echo.json',
      'recordings/add.json',
      'recordings/stamp.json',
    ]) {
      const fresh = await readFile(join(dir, file), 'utf8');
      const committed = await readFile(join(goldenDir, file), 'utf8');
      expect(fresh, file).toBe(committed);
    }
  });
});

describe('sortArrays (unordered result arrays)', () => {
  async function recordWith(config: GoldenConfig): Promise<GoldenSet> {
    return withClient('none', (client) => recordGoldens(client, config));
  }

  it('no false drift across processes: random server order is absorbed by the sort', async () => {
    const golden = await recordWith(inventoryCfg);
    const results = await withClient('none', (client) =>
      runRegression(client, golden, inventoryCfg),
    );
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
  });

  it('records the golden in sorted order, whatever order the server emitted', async () => {
    const golden = await recordWith(inventoryCfg);
    const recording = golden.recordings.find((r) => r.tool === 'inventory');
    const result = recording?.cases[0]?.result as {
      structuredContent: { items: Array<{ sku: string }> };
    };
    expect(result.structuredContent.items.map((i) => i.sku)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('a genuinely changed element still drifts, at its post-sort position', async () => {
    const golden = await recordWith(inventoryCfg);
    const { result, detail } = soleDrift(
      await withClient('inventory-item-changed', (client) =>
        runRegression(client, golden, inventoryCfg),
      ),
    );
    expect(detail.kind).toBe('behavioral');
    expect(result.status).toBe('fail');
    const paths = detail.fieldDiffs?.map((d) => d.path) ?? [];
    // cherry sorts last (index 2); only its stock changed.
    expect(paths).toEqual(['structuredContent.items[2].stock']);
  });

  it('a sortArrays rule added AFTER recording applies without a re-record', async () => {
    const unsortedCfg: GoldenConfig = {
      ...inventoryCfg,
      tools: { inventory: { cases: [{ case: 'default', arguments: {} }] } },
    };
    const golden = await recordWith(unsortedCfg);
    const results = await withClient('none', (client) =>
      runRegression(client, golden, inventoryCfg),
    );
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
  });
});

describe('record', () => {
  it('is deterministic (normalizers collapse volatile output)', async () => {
    const [a, b] = await withClient('none', async (client) => [
      await recordGoldens(client, cfg),
      await recordGoldens(client, cfg),
    ]);
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe('golden validation', () => {
  it('rejects a mismatched formatVersion with a clear error', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcph-golden-'));
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        formatVersion: 999,
        specVersion: '2025-11-25',
        server: { name: 'x', version: '1' },
        tools: [],
        resources: [],
        prompts: [],
      }),
    );
    await expect(readGoldenSet(dir)).rejects.toThrow(/formatVersion/);
  });
});

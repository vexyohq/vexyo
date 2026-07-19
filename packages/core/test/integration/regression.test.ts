import { mkdtemp, writeFile } from 'node:fs/promises';
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
  type GoldenConfig,
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
  tools: {
    echo: { cases: [{ case: 'basic', arguments: { text: 'hello' } }] },
    add: { cases: [{ case: 'basic', arguments: { a: 2, b: 3 } }] },
    stamp: { cases: [{ case: 'default', arguments: {} }] },
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

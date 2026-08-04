import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from './run';

const here = dirname(fileURLToPath(import.meta.url));
// packages/cli/src/commands -> repo root -> examples
const exampleConfig = resolve(here, '../../../../examples/basic.config.ts');
const repoRoot = resolve(here, '../../../..');

// Suppress the report written to stdout during these runs.
const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

afterEach(() => {
  stdout.mockClear();
  stderr.mockClear();
});

/** Write a temp config targeting a fixture entry (plain object — no imports). */
async function fixtureConfig(entry: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vexyo-run-'));
  const path = join(dir, 'vexyo.config.ts');
  await writeFile(
    path,
    `export default {
  specVersion: '2025-11-25',
  target: {
    transport: 'stdio',
    command: process.execPath,
    args: ['--import', 'tsx', ${JSON.stringify(resolve(repoRoot, entry))}],
    cwd: ${JSON.stringify(repoRoot)},
  },
};
`,
  );
  return path;
}

const NOISY = 'fixtures/servers/broken/src/noisy-stderr.ts';
const CRASHING = 'fixtures/servers/broken/src/crash-on-start.ts';

function allStderrOutput(): string {
  return stderr.mock.calls.map((call) => String(call[0])).join('');
}

describe('run command (against the compliant fixture)', () => {
  it('runs the suite with the json reporter and exits 0', async () => {
    const code = await runCommand({ config: exampleConfig, reporter: 'json' });
    expect(code).toBe(0);
    // The json reporter wrote parseable JSON to stdout.
    const written = String(stdout.mock.calls.at(-1)?.[0] ?? '');
    expect(() => JSON.parse(written)).not.toThrow();
  });

  it('honors --spec-version by rejecting an unwired version with exit 2', async () => {
    const code = await runCommand({
      config: exampleConfig,
      specVersion: '2026-07-28',
      reporter: 'console',
    });
    expect(code).toBe(2);
  });

  it('rejects an unknown reporter with exit 2', async () => {
    const code = await runCommand({ config: exampleConfig, reporter: 'xml' });
    expect(code).toBe(2);
  });

  it('marks a completed run with outcome: completed in json output', async () => {
    const code = await runCommand({ config: exampleConfig, reporter: 'json' });
    expect(code).toBe(0);
    const doc = JSON.parse(String(stdout.mock.calls.at(-1)?.[0] ?? '')) as {
      outcome: string;
    };
    expect(doc.outcome).toBe('completed');
  });
});

describe('captured target stderr', () => {
  it('is quiet by default: a noisy server cannot drown the report', async () => {
    const code = await runCommand({ config: await fixtureConfig(NOISY), reporter: 'console' });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls.map((c) => String(c[0])).join(''))).toContain('Summary:');
    // Not one line of the fixture's stderr flood reached our stderr.
    expect(allStderrOutput()).not.toContain('noisy-stderr warning');
  });

  it('--verbose prints the delimited block AFTER the report', async () => {
    const code = await runCommand({
      config: await fixtureConfig(NOISY),
      reporter: 'console',
      verbose: true,
    });
    expect(code).toBe(0);
    const block = allStderrOutput();
    expect(block).toContain('--- target stderr (captured, truncated to the last 64KB) ---');
    expect(block).toContain('--- end target stderr ---');
    // Cap enforced: the tail survives, the head does not.
    expect(block).toContain('noisy-stderr warning 2000');
    expect(block).not.toContain('noisy-stderr warning 0001');
    // "After the summary": every stdout (report) write precedes the stderr block.
    const lastReportWrite = Math.max(...stdout.mock.invocationCallOrder);
    const firstBlockWrite = Math.min(...stderr.mock.invocationCallOrder);
    expect(lastReportWrite).toBeLessThan(firstBlockWrite);
  });

  it('a launch failure exits 3 and always prints the captured stderr', async () => {
    const code = await runCommand({ config: await fixtureConfig(CRASHING), reporter: 'console' });
    expect(code).toBe(3);
    const output = allStderrOutput();
    expect(output).toContain('The target MCP server failed to start');
    expect(output).toContain('--- target stderr');
    expect(output).toContain('ImportError');
  });

  it('a missing binary exits 3 with the no-stderr fallback line', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vexyo-run-'));
    const path = join(dir, 'vexyo.config.ts');
    await writeFile(
      path,
      `export default { target: { transport: 'stdio', command: '/nonexistent/__vexyo_missing_binary__' } };\n`,
    );
    const code = await runCommand({ config: path, reporter: 'console' });
    expect(code).toBe(3);
    expect(allStderrOutput()).toContain('(no stderr captured from the target server)');
  });

  it('--reporter json emits a structured launch-failure document', async () => {
    const code = await runCommand({ config: await fixtureConfig(CRASHING), reporter: 'json' });
    expect(code).toBe(3);
    const doc = JSON.parse(String(stdout.mock.calls.at(-1)?.[0] ?? '')) as {
      outcome: string;
      exitCode: number;
      serverStderr: { text: string; truncated: boolean };
      target: { transport: string };
    };
    expect(doc.outcome).toBe('launch-failure');
    expect(doc.exitCode).toBe(3);
    expect(doc.target.transport).toBe('stdio');
    expect(doc.serverStderr.text).toContain('ImportError');
    expect(doc.serverStderr.truncated).toBe(false);
  });
});

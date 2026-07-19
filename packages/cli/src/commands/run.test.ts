import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from './run';

const here = dirname(fileURLToPath(import.meta.url));
// packages/cli/src/commands -> repo root -> examples
const exampleConfig = resolve(here, '../../../../examples/basic.config.ts');

// Suppress the report written to stdout during these runs.
const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

afterEach(() => {
  stdout.mockClear();
  stderr.mockClear();
});

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
});

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { connectStdio, TargetConnectionError } from '../../src/index';
import { STDERR_CAP_BYTES } from '../../src/transports/stderr';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

function stdioTarget(entry: string): Parameters<typeof connectStdio>[0] {
  return {
    command: process.execPath,
    args: ['--import', 'tsx', resolve(repoRoot, entry)],
    cwd: repoRoot,
  };
}

async function expectConnectionError(promise: Promise<unknown>): Promise<TargetConnectionError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(TargetConnectionError);
    return err as TargetConnectionError;
  }
  throw new Error('expected the connection to fail');
}

describe('stdio stderr capture', () => {
  it('a crash on startup rejects with TargetConnectionError carrying the stderr', async () => {
    const err = await expectConnectionError(
      connectStdio(stdioTarget('fixtures/servers/broken/src/crash-on-start.ts')),
    );
    expect(err.transport).toBe('stdio');
    expect(err.message).toContain('failed to start');
    expect(err.stderr).toContain('ImportError');
    expect(err.stderr).toContain('Traceback');
    expect(err.truncated).toBe(false);
  });

  it('a noisy server connects fine; its stderr is captured and capped', async () => {
    const conn = await connectStdio(stdioTarget('fixtures/servers/broken/src/noisy-stderr.ts'));
    try {
      const info = conn.client.getServerVersion();
      expect(info?.name).toBe('vexyo-noisy-stderr-fixture');
    } finally {
      await conn.close();
    }
    const snap = conn.serverStderr?.();
    expect(snap).toBeDefined();
    expect(snap?.truncated).toBe(true);
    expect(snap?.text.length).toBeLessThanOrEqual(STDERR_CAP_BYTES);
    // The tail (late lines) is kept; the head (line 0001) is dropped.
    expect(snap?.text).toContain('noisy-stderr warning 2000');
    expect(snap?.text).not.toContain('noisy-stderr warning 0001');
  });

  it('a missing binary rejects with empty captured stderr', async () => {
    const err = await expectConnectionError(
      connectStdio({ command: '/nonexistent/__vexyo_missing_binary__' }),
    );
    expect(err.stderr).toBe('');
    expect(err.truncated).toBe(false);
  });
});

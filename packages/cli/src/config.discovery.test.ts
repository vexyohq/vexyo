import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_CANDIDATES, resolveConfigPath } from './config';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'vexyo-discovery-'));
}

describe('resolveConfigPath', () => {
  it('resolves an explicit --config path against cwd', () => {
    expect(resolveConfigPath('sub/my.config.ts', '/base')).toBe('/base/sub/my.config.ts');
  });

  it('auto-discovers vexyo.config.ts in cwd', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'vexyo.config.ts'), '');
    expect(resolveConfigPath(undefined, dir)).toBe(join(dir, 'vexyo.config.ts'));
  });

  it('prefers earlier candidates: .ts wins over .js', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'vexyo.config.js'), '');
    await writeFile(join(dir, 'vexyo.config.ts'), '');
    expect(resolveConfigPath(undefined, dir)).toBe(join(dir, 'vexyo.config.ts'));
    expect(CONFIG_CANDIDATES.indexOf('vexyo.config.ts')).toBeLessThan(
      CONFIG_CANDIDATES.indexOf('vexyo.config.js'),
    );
  });

  it('falls through the candidate list to a later extension', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'vexyo.config.mjs'), '');
    expect(resolveConfigPath(undefined, dir)).toBe(join(dir, 'vexyo.config.mjs'));
  });

  it('throws a ConfigError suggesting `vexyo init` when nothing is found', async () => {
    const dir = await tempDir();
    expect(() => resolveConfigPath(undefined, dir)).toThrow(/vexyo init/);
  });
});

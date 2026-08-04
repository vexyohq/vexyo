import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
// packages/cli/src -> repo root
const repoRoot = resolve(here, '../../..');
const cliDist = resolve(repoRoot, 'packages/cli/dist/index.js');

describe('config loader resolves vexyo self-imports from the CLI, not the config dir', () => {
  beforeAll(() => {
    // A stranger runs the published dist CLI, not the source — build it (topological).
    execFileSync('pnpm', ['build:dist'], { cwd: repoRoot, stdio: 'ignore' });
  }, 120_000);

  it('loads a config from a dir with no node_modules and parses the target', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vexyo-selfresolve-'));
    await writeFile(
      join(dir, 'vexyo.config.ts'),
      `import { defineConfig } from '@vexyo/cli/config';\n` +
        `export default defineConfig({\n` +
        `  target: { transport: 'stdio', command: '__vexyo_missing_binary__' },\n` +
        `});\n`,
    );

    let output = '';
    let status: number | undefined;
    try {
      execFileSync(process.execPath, [cliDist, 'run'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      status = e.status;
    }

    // The self-import resolved (no module-resolution failure) and target parsing
    // proceeded to an actual connection attempt against the (missing) command —
    // which is a target-launch failure: exit 3, not a config error.
    expect(output).not.toContain("Cannot find module '@vexyo/cli/config'");
    expect(output).not.toContain('Could not load config file');
    expect(output).toMatch(/failed to start|__vexyo_missing_binary__/);
    expect(status).toBe(3);
  });
});

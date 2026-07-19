import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vexyo/cli/config';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

// The in-repo compliant fixture, run from TypeScript source via tsx. A real
// user would point `command`/`args` at their own already-runnable server.
const fixtureEntry = resolve(repoRoot, 'fixtures/servers/compliant/src/index.ts');

export default defineConfig({
  specVersion: '2025-11-25',
  target: {
    transport: 'stdio',
    command: process.execPath, // node
    args: ['--import', 'tsx', fixtureEntry],
    cwd: repoRoot,
  },
});

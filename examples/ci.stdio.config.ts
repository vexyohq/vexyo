import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vexyo/cli/config';

// CI dogfooding config (stdio). A real user would point `command`/`args` at
// their own already-built server; here we spawn the in-repo compliant fixture.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  specVersion: '2025-11-25',
  target: {
    transport: 'stdio',
    command: process.execPath,
    args: ['--import', 'tsx', resolve(repoRoot, 'fixtures/servers/compliant/src/index.ts')],
    cwd: repoRoot,
  },
});

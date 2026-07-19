import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vexyo/cli/config';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

// The regression fixture in baseline mode (`--defect none`). A real user would
// point this at their own already-runnable server.
const fixtureEntry = resolve(repoRoot, 'fixtures/servers/broken/src/regression.ts');

export default defineConfig({
  specVersion: '2025-11-25',
  target: {
    transport: 'stdio',
    command: process.execPath, // node
    args: ['--import', 'tsx', fixtureEntry, '--defect', 'none'],
    cwd: repoRoot,
  },
  regression: {
    // Committed golden set lives under fixtures/ so tests can read it.
    goldenDir: '../fixtures/goldens',
    normalizers: ['iso-timestamp', 'uuid'],
    record: {
      echo: { cases: [{ case: 'basic', arguments: { text: 'hello' } }] },
      add: { cases: [{ case: 'basic', arguments: { a: 2, b: 3 } }] },
      stamp: { cases: [{ case: 'default', arguments: {} }] },
    },
  },
});

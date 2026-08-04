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
    // Path-scoped rules (kept commented here so the committed goldens stay put):
    // scope a normalizer to one JSON path — the syntax matches drift-report
    // paths — declare an array's order insignificant, or exclude a path from
    // comparison entirely.
    // paths: { 'structuredContent.items[*].id': 'uuid' },
    // sortArrays: ['structuredContent.items'],
    // ignore: ['meta.elapsedMs'],
    record: {
      echo: { cases: [{ case: 'basic', arguments: { text: 'hello' } }] },
      add: { cases: [{ case: 'basic', arguments: { a: 2, b: 3 } }] },
      stamp: { cases: [{ case: 'default', arguments: {} }] },
    },
  },
});

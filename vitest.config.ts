import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Packages export TypeScript source directly (see each package's `exports`).
    // Alias the workspace names so tests resolve to source without a build step.
    alias: {
      '@vexyo/core': r('./packages/core/src/index.ts'),
      '@vexyo/reporters': r('./packages/reporters/src/index.ts'),
      '@vexyo/cli/config': r('./packages/cli/src/define.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'packages/**/test/**/*.test.ts'],
    // Integration tests spawn a fixture server over stdio.
    testTimeout: 20_000,
  },
});

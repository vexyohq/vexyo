import { defineConfig } from 'tsup';

// Three published entries: `.` (the `vexyo` bin), `./config` (defineConfig),
// and `./api` (executeRun for the Action). ESM code-splitting shares run.ts
// between index and api. Deps + @vexyo/* are external.
export default defineConfig({
  entry: ['src/index.ts', 'src/define.ts', 'src/api.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
});

import { defineConfig } from 'tsup';

// Emits the published artifact. Deps (SDK, zod, @vexyo/*) are external — consumers
// resolve them. Dev never runs this: tools use the `development` export condition
// to resolve `@vexyo/*` → src (see tsconfig customConditions / vitest alias).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
});

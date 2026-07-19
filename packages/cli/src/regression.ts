import { dirname, resolve } from 'node:path';
import type { GoldenConfig } from '@vexyo/core';
import type { RegressionConfig } from './config';

/** Resolve `goldenDir` relative to the config file's directory. */
export function resolveGoldenDir(configPath: string, regression: RegressionConfig): string {
  return resolve(dirname(resolve(process.cwd(), configPath)), regression.goldenDir);
}

/** Map the CLI's regression config onto the core engine's {@link GoldenConfig}. */
export function toGoldenConfig(specVersion: string, regression: RegressionConfig): GoldenConfig {
  return {
    specVersion,
    defaultNormalizers: regression.normalizers,
    tools: Object.fromEntries(
      Object.entries(regression.record).map(([name, spec]) => [
        name,
        { cases: spec.cases, normalizers: spec.normalizers },
      ]),
    ),
  };
}

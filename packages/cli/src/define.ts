import type { UserConfig } from './config';

export type { UserConfig };

/**
 * Identity helper that gives config authors editor autocomplete and type
 * checking. Kept free of runtime dependencies (no jiti/zod pulled in) so it is
 * cheap to import from a config file.
 */
export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

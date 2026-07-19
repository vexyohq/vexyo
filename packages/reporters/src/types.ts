import type { RunResult } from '@vexyo/core';

/**
 * A reporter renders a {@link RunResult} to a string. Reporters consume the
 * public result contract only — never core internals (CLAUDE.md hard rule #7).
 */
export interface Reporter {
  readonly name: string;
  format(result: RunResult): string;
}

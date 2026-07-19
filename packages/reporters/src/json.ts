import type { RunResult } from '@vexyo/core';
import type { Reporter } from './types';

/**
 * Serializes the full {@link RunResult} as pretty-printed JSON for machine
 * consumption (CI artifacts, further processing). Consumes the public result
 * contract only (CLAUDE.md hard rule #7).
 */
export const jsonReporter: Reporter = {
  name: 'json',
  format(result: RunResult): string {
    return JSON.stringify(result, null, 2);
  },
};

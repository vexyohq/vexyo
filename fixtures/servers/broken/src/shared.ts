import type { ServerResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Shared plumbing for the deliberately-broken fixture servers. Each server
 * exhibits exactly ONE defect (selected via `--defect`, parsed by the shared
 * `serve` helper) and is otherwise conformant (CLAUDE.md hard rule #3).
 */

/** The custom, unsupported method the `errors/unknown-method` rule probes. */
export const PROBE_UNSUPPORTED_METHOD = 'vexyo/probe-unsupported-method';

/**
 * An Error carrying a JSON-RPC `code` but an intentionally empty `message`. The
 * SDK server serializes `error.message` verbatim, so this produces a malformed
 * error object with an empty message on the wire.
 */
export class BareError extends Error {
  readonly code: number;
  constructor(code: number) {
    super('');
    this.code = code;
    this.name = 'BareError';
  }
}

/**
 * Cast an arbitrary (possibly non-conformant) payload to `ServerResult`. The
 * low-level `Server` does not validate outgoing results, so this lets a fixture
 * send deliberately malformed responses while keeping the file type-checked.
 */
export function raw(value: unknown): ServerResult {
  return value as ServerResult;
}

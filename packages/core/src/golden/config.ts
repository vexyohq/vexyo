import type { NormalizerRef } from './normalize';

/** One recorded invocation of a tool: a case name plus the arguments to send. */
export interface GoldenCaseSpec {
  case: string;
  arguments: Record<string, unknown>;
}

/** Recording plan for a single tool (explicit opt-in — see `record`). */
export interface GoldenToolSpec {
  cases: GoldenCaseSpec[];
  /** Overrides the default normalizers for this tool. */
  normalizers?: NormalizerRef[];
}

/** The regression engine's view of the config (built by the CLI from zod). */
export interface GoldenConfig {
  specVersion: string;
  defaultNormalizers: NormalizerRef[];
  /** Tools to record/compare, keyed by tool name. Empty = record nothing. */
  tools: Record<string, GoldenToolSpec>;
}

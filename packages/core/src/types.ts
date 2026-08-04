/**
 * The public result contract consumed by every reporter.
 *
 * CLAUDE.md hard rule #7: reporters consume `RunResult` only; breaking this
 * shape is a semver-major event. Keep it stable and additive.
 */

/**
 * MCP spec versions this harness knows about. A run targets exactly one
 * (CLAUDE.md hard rule #2 — spec versions never mix). Only the stable version
 * is wired up today; `2026-07-28` is a scaffolding slot for the RC.
 */
export type SpecVersion = '2025-11-25' | '2026-07-28';

/** The stable spec version this build fully supports. */
export const STABLE_SPEC_VERSION: SpecVersion = '2025-11-25';

export type Severity = 'error' | 'warning' | 'info';

export type Category =
  'initialization' | 'discovery' | 'error-semantics' | 'transport' | 'security' | 'regression';

/**
 * Outcome of running one rule:
 * - `pass`  — rule ran and produced no findings.
 * - `fail`  — rule produced at least one `error`-severity finding.
 * - `warn`  — rule produced findings, but none above `warning`/`info` severity.
 * - `skip`  — rule was not applicable (e.g. capability not advertised).
 * - `error` — rule threw unexpectedly (server crash or harness bug).
 */
export type RuleStatus = 'pass' | 'fail' | 'warn' | 'skip' | 'error';

/** A single problem detected by a rule. A rule with zero findings passed. */
export interface Finding {
  ruleId: string;
  severity: Severity;
  /** What is wrong. */
  message: string;
  /** What to do next (CLAUDE.md: every user-facing failure states the fix). */
  remediation: string;
  /** Spec section citation, e.g. "Base Protocol §Lifecycle". */
  specRef: string;
  /** Optional machine-readable context (offending payload, error, etc.). */
  detail?: unknown;
}

export interface RuleResult {
  ruleId: string;
  title: string;
  category: Category;
  severity: Severity;
  specVersion: SpecVersion;
  /** Spec section citation for this rule, surfaced by reporters. */
  specRef: string;
  status: RuleStatus;
  /**
   * Why the rule was skipped. A skip means either "not applicable" (capability
   * absent) or "a prerequisite is unavailable" (e.g. `tools/list` failed, so
   * rules that consume it skip rather than cascade errors).
   */
  skipReason?: string;
  findings: Finding[];
  durationMs: number;
}

export interface RunTarget {
  transport: 'stdio' | 'http';
  /** Human-readable description of what we connected to. */
  description: string;
}

export interface RunSummary {
  pass: number;
  fail: number;
  warn: number;
  skip: number;
  error: number;
  total: number;
}

export interface RunResult {
  /**
   * Discriminator against the CLI's launch-failure JSON document (`outcome:
   * 'launch-failure'`): a RunResult always means the suite actually ran.
   * Required on purpose — an optional field would leave consumers handling
   * `undefined`, which is the ambiguity it exists to remove.
   */
  outcome: 'completed';
  specVersion: SpecVersion;
  target: RunTarget;
  /** ISO-8601 timestamps. */
  startedAt: string;
  finishedAt: string;
  results: RuleResult[];
  summary: RunSummary;
  /**
   * 0 = pass, 1 = findings at/above threshold. (2 is vestigial: harness/config
   * errors throw before a RunResult exists and exit 2; a target that failed to
   * start throws {@link TargetConnectionError} and exits 3.)
   */
  exitCode: 0 | 1 | 2;
  /**
   * Captured tail of the stdio child's stderr (never inherited). Present only
   * for stdio targets that wrote to stderr.
   */
  serverStderr?: { text: string; truncated: boolean };
}

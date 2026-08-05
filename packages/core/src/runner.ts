import { cleanErrorMessage } from './mcp/errors';
import { connectTarget, type ConnectTarget } from './transports/index';
import { rulesForSpecVersion } from './registry';
import { SkipRule, type Rule, type RuleContext } from './rule';
import type {
  RuleResult,
  RunResult,
  RunSummary,
  RunTarget,
  ServerIdentity,
  Severity,
  SpecVersion,
} from './types';

export interface RunSuiteOptions {
  specVersion: SpecVersion;
  target: ConnectTarget;
  /** Severity at/above which findings cause a non-zero exit. Default `error`. */
  failOn?: Severity;
  /**
   * Optional extra checks run against the *same* connection after the
   * conformance rules (e.g. regression drift). Their results are appended.
   */
  extraChecks?: (ctx: RuleContext) => Promise<RuleResult[]>;
}

/** Human-readable description of a connect target for reporters. */
function describeTarget(target: ConnectTarget): RunTarget {
  if (target.transport === 'http') {
    return { transport: 'http', description: `http: ${target.http.url}` };
  }
  const { command, args } = target.stdio;
  return { transport: 'stdio', description: `stdio: ${command} ${(args ?? []).join(' ')}`.trim() };
}

const SEVERITY_RANK: Record<Severity, number> = { info: 1, warning: 2, error: 3 };

/**
 * Connect to the target server, run every rule for the requested spec version
 * (plus any extra checks), and assemble a {@link RunResult}. Connection/
 * handshake failures throw a `TargetConnectionError` (the CLI maps it to exit
 * code 3; other harness/config errors map to 2); per-rule failures are
 * captured as findings.
 */
export async function runSuite(opts: RunSuiteOptions): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const failOn: Severity = opts.failOn ?? 'error';
  const rules = rulesForSpecVersion(opts.specVersion);
  const target = describeTarget(opts.target);

  const conn = await connectTarget(opts.target);
  // Captured before close(): the client getters are only guaranteed while the
  // connection lives. All from the initialize exchange — no extra round trip.
  const server = serverIdentity(conn);
  let results: RuleResult[];
  try {
    const ctx: RuleContext = {
      client: conn.client,
      serverInfo: conn.client.getServerVersion(),
      capabilities: conn.client.getServerCapabilities(),
      transport: conn.transport,
      specVersion: opts.specVersion,
    };
    results = await runRules(ctx, rules);
    if (opts.extraChecks) {
      results.push(...(await opts.extraChecks(ctx)));
    }
  } finally {
    await conn.close().catch(() => undefined);
  }

  const finishedAt = new Date().toISOString();
  // Snapshot after close() so shutdown-time stderr is included; omit when empty.
  const stderr = conn.serverStderr?.();
  return {
    outcome: 'completed',
    server,
    specVersion: opts.specVersion,
    target,
    startedAt,
    finishedAt,
    results,
    summary: summarizeResults(results),
    exitCode: computeExitCode(results, failOn),
    ...(stderr && stderr.text !== '' ? { serverStderr: stderr } : {}),
  };
}

/** Assemble {@link ServerIdentity} from a live connection's initialize data. */
function serverIdentity(conn: Awaited<ReturnType<typeof connectTarget>>): ServerIdentity {
  const instructions = conn.client.getInstructions();
  return {
    negotiatedProtocolVersion: conn.negotiatedProtocolVersion,
    // The getters are always set after a successful connect; the fallbacks are
    // unreachable and exist only to satisfy the `| undefined` return types.
    serverInfo: conn.client.getServerVersion() ?? { name: '', version: '' },
    capabilities: conn.client.getServerCapabilities() ?? {},
    ...(instructions !== undefined ? { instructions } : {}),
  };
}

/**
 * Run a set of rules against an already-connected context. Extracted from
 * {@link runSuite} so rule-outcome handling is unit-testable without a live
 * server connection.
 */
export async function runRules(ctx: RuleContext, rules: readonly Rule[]): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  for (const rule of rules) {
    results.push(await runOneRule(rule, ctx));
  }
  return results;
}

async function runOneRule(rule: Rule, ctx: RuleContext): Promise<RuleResult> {
  const start = Date.now();
  const base = {
    ruleId: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    specVersion: rule.specVersion,
    specRef: rule.specRef,
  } as const;

  try {
    const findings = await rule.run(ctx);
    return {
      ...base,
      status: statusFromFindings(findings),
      findings,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof SkipRule) {
      return {
        ...base,
        status: 'skip',
        skipReason: err.reason,
        findings: [],
        durationMs: Date.now() - start,
      };
    }
    return {
      ...base,
      status: 'error',
      findings: [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: `Rule threw an unexpected error: ${cleanErrorMessage(err)}`,
          remediation:
            'This usually means the server crashed mid-run or the rule has a bug. ' +
            'Re-run and inspect the server logs.',
          specRef: rule.specRef,
          detail: err instanceof Error ? { stack: err.stack } : err,
        },
      ],
      durationMs: Date.now() - start,
    };
  }
}

/** A result passes with no findings, fails on any error-severity finding, else warns. */
function statusFromFindings(findings: { severity: Severity }[]): 'pass' | 'fail' | 'warn' {
  if (findings.length === 0) {
    return 'pass';
  }
  return findings.some((f) => f.severity === 'error') ? 'fail' : 'warn';
}

export function summarizeResults(results: RuleResult[]): RunSummary {
  const summary: RunSummary = {
    pass: 0,
    fail: 0,
    warn: 0,
    skip: 0,
    error: 0,
    total: results.length,
  };
  for (const result of results) {
    summary[result.status] += 1;
  }
  return summary;
}

/**
 * Exit 1 if any rule errored, or any finding is at/above the `failOn` severity;
 * otherwise 0. Harness/config errors (exit 2) surface as thrown exceptions.
 */
export function computeExitCode(results: RuleResult[], failOn: Severity): 0 | 1 {
  const threshold = SEVERITY_RANK[failOn];
  for (const result of results) {
    if (result.status === 'error') {
      return 1;
    }
    for (const finding of result.findings) {
      if (SEVERITY_RANK[finding.severity] >= threshold) {
        return 1;
      }
    }
  }
  return 0;
}

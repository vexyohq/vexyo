import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Implementation, ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { TransportInfo } from './transports/types';
import type { Category, Finding, Severity, SpecVersion } from './types';

/**
 * Everything a rule needs to make its assessment. The runner owns the
 * connection lifecycle; a rule never spawns processes or manages sockets
 * (CLAUDE.md hard rule #1 + architecture note).
 */
export interface RuleContext {
  /** Connected MCP client (handshake already completed). */
  readonly client: Client;
  /** Server identity captured during initialization. */
  readonly serverInfo: Implementation | undefined;
  /** Capabilities the server advertised during negotiation. */
  readonly capabilities: ServerCapabilities | undefined;
  /** The transport in use, plus transport-specific facts (e.g. HTTP session id). */
  readonly transport: TransportInfo;
  readonly specVersion: SpecVersion;
}

/**
 * A rule is a pure, declarative conformance check. It returns the findings it
 * detected; an empty array means the server passed. Applicability is signalled
 * by throwing {@link SkipRule}.
 */
export interface Rule {
  readonly id: string;
  /** Exactly one spec version (CLAUDE.md hard rule #2). */
  readonly specVersion: SpecVersion;
  readonly category: Category;
  readonly severity: Severity;
  readonly title: string;
  /** Spec section citation surfaced to users, e.g. "Base Protocol §Lifecycle". */
  readonly specRef: string;
  run(ctx: RuleContext): Promise<Finding[]>;
}

/**
 * Thrown by a rule to declare itself not applicable to this server (e.g. the
 * relevant capability was never advertised). The runner records a `skip`
 * rather than a pass or fail.
 */
export class SkipRule extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'SkipRule';
  }
}

/** Build a {@link Finding}, prefilling identity fields from the rule. */
export function finding(
  rule: Pick<Rule, 'id' | 'severity' | 'specRef'>,
  message: string,
  remediation: string,
  detail?: unknown,
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    message,
    remediation,
    specRef: rule.specRef,
    detail,
  };
}

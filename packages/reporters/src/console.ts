import type { Category, RuleResult, RunResult } from '@vexyo/core';
import type { Reporter } from './types';

const STATUS_LABEL: Record<RuleResult['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  warn: 'WARN',
  skip: 'SKIP',
  error: 'ERR ',
};

function groupByCategory(results: RuleResult[]): Map<Category, RuleResult[]> {
  const groups = new Map<Category, RuleResult[]>();
  for (const result of results) {
    const bucket = groups.get(result.category) ?? [];
    bucket.push(result);
    groups.set(result.category, bucket);
  }
  return groups;
}

/**
 * Human-readable console output: findings grouped by category, each rule shown
 * with its status, id, and spec citation; failures list the problem and the
 * one-line remediation (CLAUDE.md CLI output convention).
 */
export const consoleReporter: Reporter = {
  name: 'console',
  format(result: RunResult): string {
    const lines: string[] = [];
    lines.push(`vexyo — MCP spec ${result.specVersion}`);
    lines.push(`target: ${result.target.description}`);
    lines.push('');

    for (const [category, rules] of groupByCategory(result.results)) {
      lines.push(`${category}`);
      for (const rule of rules) {
        const skipNote =
          rule.status === 'skip' && rule.skipReason ? `  — skipped: ${rule.skipReason}` : '';
        lines.push(`  [${STATUS_LABEL[rule.status]}] ${rule.ruleId}  (${rule.specRef})${skipNote}`);
        for (const f of rule.findings) {
          lines.push(`         ${f.severity}: ${f.message}`);
          lines.push(`         → ${f.remediation}`);
        }
      }
      lines.push('');
    }

    const s = result.summary;
    lines.push(
      `Summary: ${s.pass} pass, ${s.fail} fail, ${s.warn} warn, ${s.error} error, ${s.skip} skip (${s.total} rules)`,
    );
    lines.push(`Exit code: ${result.exitCode}`);
    return lines.join('\n');
  },
};

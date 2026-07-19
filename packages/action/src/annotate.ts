import type { RunResult } from '@vexyo/core';

export interface Annotation {
  severity: 'error' | 'warning';
  title: string;
  message: string;
}

/**
 * Map a {@link RunResult} to PR annotations: one per error/warning finding,
 * titled by rule id. Pure (no `@actions/core` side effects) so it is unit-tested
 * without a GitHub environment.
 */
export function annotate(result: RunResult): Annotation[] {
  const annotations: Annotation[] = [];
  for (const rule of result.results) {
    for (const finding of rule.findings) {
      if (finding.severity === 'error' || finding.severity === 'warning') {
        annotations.push({
          severity: finding.severity,
          title: rule.ruleId,
          message: `${finding.message} — ${finding.remediation}`,
        });
      }
    }
  }
  return annotations;
}

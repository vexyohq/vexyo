import type { Category, Finding, RuleResult, RunResult } from '@vexyo/core';
import type { Reporter } from './types';

/**
 * JUnit XML for native CI ingestion. Consumes `RunResult` only (hard rule #7).
 * One `<testsuite>` per category; each rule is a `<testcase>`:
 * fail→`<failure>`, error→`<error>`, skip→`<skipped/>`, and warn→a passing
 * testcase with the finding in `<system-out>` (a warning does not fail the run).
 */
export const junitReporter: Reporter = {
  name: 'junit',
  format(result: RunResult): string {
    const byCategory = new Map<Category, RuleResult[]>();
    for (const r of result.results) {
      const bucket = byCategory.get(r.category) ?? [];
      bucket.push(r);
      byCategory.set(r.category, bucket);
    }

    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    const total = counts(result.results);
    lines.push(
      `<testsuites name="vexyo" tests="${result.results.length}" ` +
        `failures="${total.failures}" errors="${total.errors}" skipped="${total.skipped}">`,
    );

    for (const [category, rules] of byCategory) {
      const c = counts(rules);
      lines.push(
        `  <testsuite name="${esc(category)}" tests="${rules.length}" ` +
          `failures="${c.failures}" errors="${c.errors}" skipped="${c.skipped}">`,
      );
      for (const rule of rules) {
        lines.push(...renderCase(rule));
      }
      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return `${lines.join('\n')}\n`;
  },
};

function renderCase(rule: RuleResult): string[] {
  const open = `    <testcase name="${esc(rule.ruleId)}" classname="${esc(rule.category)}" time="${(rule.durationMs / 1000).toFixed(3)}"`;
  switch (rule.status) {
    case 'pass':
      return [`${open} />`];
    case 'skip': {
      const message = rule.skipReason ? ` message="${esc(rule.skipReason)}"` : '';
      return [`${open}>`, `      <skipped${message} />`, '    </testcase>'];
    }
    case 'warn':
      return [
        `${open}>`,
        `      <system-out>${esc(findingsText(rule.findings))}</system-out>`,
        '    </testcase>',
      ];
    default: {
      const tag = rule.status === 'error' ? 'error' : 'failure';
      const message = esc(rule.findings[0]?.message ?? rule.status);
      return [
        `${open}>`,
        `      <${tag} message="${message}">${esc(findingsText(rule.findings))}</${tag}>`,
        '    </testcase>',
      ];
    }
  }
}

function counts(rules: RuleResult[]): { failures: number; errors: number; skipped: number } {
  return {
    failures: rules.filter((r) => r.status === 'fail').length,
    errors: rules.filter((r) => r.status === 'error').length,
    skipped: rules.filter((r) => r.status === 'skip').length,
  };
}

function findingsText(findings: Finding[]): string {
  return findings
    .map((f) => `[${f.severity}] ${f.message} (${f.specRef}) -> ${f.remediation}`)
    .join('\n');
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

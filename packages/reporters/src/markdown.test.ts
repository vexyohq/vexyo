import type { Finding, RegressionDetail, RuleResult, RunResult } from '@vexyo/core';
import { describe, expect, it } from 'vitest';
import { markdownReporter } from './markdown';

function rule(partial: Partial<RuleResult> & Pick<RuleResult, 'ruleId' | 'status'>): RuleResult {
  return {
    ruleId: partial.ruleId,
    title: partial.title ?? partial.ruleId,
    category: partial.category ?? 'discovery',
    severity: partial.severity ?? 'error',
    specVersion: '2025-11-25',
    specRef: partial.specRef ?? 'Some §Section',
    status: partial.status,
    skipReason: partial.skipReason,
    findings: partial.findings ?? [],
    durationMs: 0,
  };
}

function finding(ruleId: string, over: Partial<Finding> = {}): Finding {
  return {
    ruleId,
    severity: over.severity ?? 'error',
    message: over.message ?? 'something is wrong',
    remediation: over.remediation ?? 'do the thing',
    specRef: over.specRef ?? 'Some §Section',
    detail: over.detail,
  };
}

function runResult(results: RuleResult[]): RunResult {
  const summary = { pass: 0, fail: 0, warn: 0, skip: 0, error: 0, total: results.length };
  for (const r of results) {
    summary[r.status] += 1;
  }
  return {
    outcome: 'completed',
    server: {
      negotiatedProtocolVersion: '2025-11-25',
      serverInfo: { name: 'sample-server', version: '1.0.0' },
      capabilities: { tools: {} },
    },
    specVersion: '2025-11-25',
    target: { transport: 'stdio', description: 'stdio: node server.js' },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    results,
    summary,
    exitCode: summary.fail + summary.error > 0 ? 1 : 0,
  };
}

describe('markdownReporter — green render', () => {
  it('shows only the overview table (no failure/skip sections) when all pass', () => {
    const out = markdownReporter.format(
      runResult([rule({ ruleId: 'a', status: 'pass' }), rule({ ruleId: 'b', status: 'pass' })]),
    );
    expect(out).toContain('| Conformance | ✅ 2 passed · 0 failed |');
    expect(out).not.toContain('### Failures & errors');
    expect(out).not.toContain('Skipped');
  });

  it('does not surface skips on an otherwise-green run', () => {
    const out = markdownReporter.format(
      runResult([
        rule({ ruleId: 'a', status: 'pass' }),
        rule({ ruleId: 'b', status: 'skip', skipReason: 'not applicable' }),
      ]),
    );
    expect(out).not.toContain('### Failures & errors');
    expect(out).not.toContain('Skipped');
  });

  it('shows server identity in the overview table, even on a green run', () => {
    const out = markdownReporter.format(runResult([rule({ ruleId: 'a', status: 'pass' })]));
    expect(out).toContain('| Server | sample-server 1.0.0 (protocol 2025-11-25) |');
    expect(out).not.toContain('Negotiated protocol');
  });

  it('calls out a version mismatch, including on a green run', () => {
    const result = runResult([rule({ ruleId: 'a', status: 'pass' })]);
    result.server = { ...result.server, negotiatedProtocolVersion: '2025-03-26' };
    const out = markdownReporter.format(result);
    expect(out).toContain('| Server | sample-server 1.0.0 (protocol 2025-03-26) |');
    expect(out).toContain(
      'Negotiated protocol 2025-03-26 differs from the targeted spec 2025-11-25',
    );
  });
});

describe('markdownReporter — failure render', () => {
  it('renders a Failures & errors section with id, severity, spec citation, message, fix', () => {
    const out = markdownReporter.format(
      runResult([
        rule({ ruleId: 'init/ok', status: 'pass' }),
        rule({
          ruleId: 'discovery/tools-list-available',
          status: 'fail',
          specRef: 'Server Features §Tools',
          findings: [
            finding('discovery/tools-list-available', {
              message: 'tools/list failed',
              remediation: 'implement tools/list',
              specRef: 'Server Features §Tools',
            }),
          ],
        }),
        rule({
          ruleId: 'discovery/tools-have-names',
          status: 'error',
          findings: [finding('discovery/tools-have-names', { message: 'threw unexpectedly' })],
        }),
      ]),
    );
    expect(out).toContain('### Failures & errors');
    expect(out).toContain('`discovery/tools-list-available`');
    expect(out).toContain('_error_'); // explicit severity word
    expect(out).toContain('Server Features §Tools'); // spec citation
    expect(out).toContain('tools/list failed'); // message
    expect(out).toContain('**Fix:** implement tools/list'); // remediation
    expect(out).toContain('`discovery/tools-have-names`');
    expect(out).toContain('threw unexpectedly');
  });

  it('lists warnings in their own section, not folded into failures', () => {
    const out = markdownReporter.format(
      runResult([
        rule({
          ruleId: 'w/warn',
          status: 'warn',
          severity: 'warning',
          findings: [finding('w/warn', { severity: 'warning', message: 'heads up' })],
        }),
      ]),
    );
    expect(out).toContain('### Warnings');
    expect(out).not.toContain('### Failures & errors');
    expect(out).toContain('heads up');
  });

  it('renders skipped-with-reason in a collapsed block when there are failures', () => {
    const out = markdownReporter.format(
      runResult([
        rule({ ruleId: 'f', status: 'fail', findings: [finding('f')] }),
        rule({
          ruleId: 'discovery/tools-have-names',
          status: 'skip',
          skipReason: 'tools/list unavailable',
        }),
      ]),
    );
    expect(out).toContain('<summary>Skipped (1)</summary>');
    expect(out).toContain('`discovery/tools-have-names` — tools/list unavailable');
  });

  it('caps the failure list and reports how many more', () => {
    const many = Array.from({ length: 55 }, (_, i) =>
      rule({
        ruleId: `r${i}`,
        status: 'fail',
        findings: [finding(`r${i}`, { message: `msg ${i}` })],
      }),
    );
    const out = markdownReporter.format(runResult(many));
    expect(out).toContain('`r0`');
    expect(out).not.toContain('`r54`'); // beyond the 50 cap
    expect(out).toContain('… 5 more — see logs');
  });

  it('collapses behavioral drift before/after in a <details> block', () => {
    const detail: RegressionDetail = {
      kind: 'behavioral',
      target: { type: 'tool', name: 'stamp', case: 'default' },
      change: 'changed',
      before: {},
      after: {},
      fieldDiffs: [{ path: 'content[0].text', before: 'a', after: 'b' }],
    };
    const out = markdownReporter.format(
      runResult([
        rule({
          ruleId: 'regression/behavioral-drift:tool:stamp:default',
          status: 'fail',
          category: 'regression',
          findings: [finding('regression/behavioral-drift:tool:stamp:default', { detail })],
        }),
      ]),
    );
    expect(out).toContain('<summary>before / after</summary>');
    expect(out).toContain('```diff');
    expect(out).toContain('- a');
    expect(out).toContain('+ b');
  });

  it('keeps every table row narrow (no horizontal scroll)', () => {
    const out = markdownReporter.format(
      runResult([rule({ ruleId: 'f', status: 'fail', findings: [finding('f')] })]),
    );
    for (const row of out.split('\n').filter((l) => l.startsWith('|'))) {
      expect(row.length).toBeLessThan(80);
    }
  });
});

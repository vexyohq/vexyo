import { describe, expect, it } from 'vitest';
import { computeExitCode, runRules } from './runner';
import { SkipRule, type Rule, type RuleContext } from './rule';

// No live server needed: runRules operates on a prebuilt context.
const ctx = {
  client: undefined,
  serverInfo: undefined,
  capabilities: undefined,
  specVersion: '2025-11-25',
} as unknown as RuleContext;

function fakeRule(id: string, run: Rule['run']): Rule {
  return {
    id,
    specVersion: '2025-11-25',
    category: 'discovery',
    severity: 'error',
    title: id,
    specRef: 'test',
    run,
  };
}

describe('runRules', () => {
  it('records pass / fail / skip / error per rule outcome', async () => {
    const rules: Rule[] = [
      fakeRule('a/pass', async () => []),
      fakeRule('b/fail', async () => [
        {
          ruleId: 'b/fail',
          severity: 'error',
          message: 'nope',
          remediation: 'fix it',
          specRef: 'test',
        },
      ]),
      fakeRule('c/skip', async () => {
        throw new SkipRule('not applicable');
      }),
      fakeRule('d/error', async () => {
        throw new Error('boom');
      }),
    ];

    const results = await runRules(ctx, rules);
    const byId = Object.fromEntries(results.map((r) => [r.ruleId, r]));

    expect(byId['a/pass']?.status).toBe('pass');
    expect(byId['b/fail']?.status).toBe('fail');
    expect(byId['b/fail']?.findings).toHaveLength(1);
    expect(byId['c/skip']?.status).toBe('skip');
    expect(byId['d/error']?.status).toBe('error');
    // A thrown rule is captured, never propagated.
    expect(byId['d/error']?.findings[0]?.message).toContain('boom');
  });

  it('reports `warn` for a result whose only findings are warnings', async () => {
    const warnRule = fakeRule('w/warn', async () => [
      {
        ruleId: 'w/warn',
        severity: 'warning',
        message: 'heads up',
        remediation: 'consider fixing',
        specRef: 'test',
      },
    ]);
    const [result] = await runRules(ctx, [warnRule]);
    expect(result?.status).toBe('warn');
  });
});

describe('computeExitCode', () => {
  const warnResult = {
    ruleId: 'w',
    title: 'w',
    category: 'regression' as const,
    severity: 'warning' as const,
    specVersion: '2025-11-25' as const,
    specRef: 'test',
    status: 'warn' as const,
    findings: [
      {
        ruleId: 'w',
        severity: 'warning' as const,
        message: 'm',
        remediation: 'r',
        specRef: 'test',
      },
    ],
    durationMs: 0,
  };

  it('does not fail on a warning under the default `error` threshold', () => {
    expect(computeExitCode([warnResult], 'error')).toBe(0);
  });

  it('fails on a warning when the threshold is `warning`', () => {
    expect(computeExitCode([warnResult], 'warning')).toBe(1);
  });
});

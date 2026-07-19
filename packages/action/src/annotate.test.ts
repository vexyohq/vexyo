import type { RunResult } from '@vexyo/core';
import { describe, expect, it } from 'vitest';
import { annotate } from './annotate';

function result(): RunResult {
  return {
    specVersion: '2025-11-25',
    target: { transport: 'stdio', description: 'x' },
    startedAt: 'a',
    finishedAt: 'b',
    results: [
      {
        ruleId: 'discovery/tools-have-names',
        title: 't',
        category: 'discovery',
        severity: 'error',
        specVersion: '2025-11-25',
        specRef: 'ref',
        status: 'fail',
        findings: [
          {
            ruleId: 'discovery/tools-have-names',
            severity: 'error',
            message: 'empty name',
            remediation: 'fix it',
            specRef: 'ref',
          },
        ],
        durationMs: 1,
      },
      {
        ruleId: 'init/server-info-name',
        title: 't',
        category: 'initialization',
        severity: 'error',
        specVersion: '2025-11-25',
        specRef: 'ref',
        status: 'pass',
        findings: [],
        durationMs: 1,
      },
    ],
    summary: { pass: 1, fail: 1, warn: 0, skip: 0, error: 0, total: 2 },
    exitCode: 1,
  };
}

describe('annotate', () => {
  it('emits one annotation per error/warning finding, titled by rule id', () => {
    const annotations = annotate(result());
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toEqual({
      severity: 'error',
      title: 'discovery/tools-have-names',
      message: 'empty name — fix it',
    });
  });

  it('produces no annotations for an all-pass result', () => {
    const clean = result();
    clean.results = clean.results.filter((r) => r.status === 'pass');
    expect(annotate(clean)).toEqual([]);
  });
});

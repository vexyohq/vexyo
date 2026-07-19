import type { RunResult } from '@vexyo/core';
import { describe, expect, it } from 'vitest';
import { jsonReporter } from './json';

function sampleResult(): RunResult {
  return {
    specVersion: '2025-11-25',
    target: { transport: 'stdio', description: 'stdio: node server.js' },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    results: [
      {
        ruleId: 'discovery/tools-list-available',
        title: 'tools list',
        category: 'discovery',
        severity: 'error',
        specVersion: '2025-11-25',
        specRef: 'Server Features §Tools',
        status: 'pass',
        findings: [],
        durationMs: 5,
      },
    ],
    summary: { pass: 1, fail: 0, warn: 0, skip: 0, error: 0, total: 1 },
    exitCode: 0,
  };
}

describe('jsonReporter', () => {
  it('emits parseable JSON that round-trips the result', () => {
    const out = jsonReporter.format(sampleResult());
    const parsed: RunResult = JSON.parse(out);
    expect(parsed.summary.pass).toBe(1);
    expect(parsed.specVersion).toBe('2025-11-25');
    expect(parsed.results[0]?.ruleId).toBe('discovery/tools-list-available');
    expect(parsed.exitCode).toBe(0);
  });
});

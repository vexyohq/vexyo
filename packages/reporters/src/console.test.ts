import type { RunResult } from '@vexyo/core';
import { describe, expect, it } from 'vitest';
import { consoleReporter } from './console';

function sampleResult(): RunResult {
  return {
    specVersion: '2025-11-25',
    target: { transport: 'stdio', description: 'stdio: node server.js' },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    results: [
      {
        ruleId: 'init/handshake-succeeds',
        title: 'handshake',
        category: 'initialization',
        severity: 'error',
        specVersion: '2025-11-25',
        specRef: 'Base Protocol §Lifecycle',
        status: 'pass',
        findings: [],
        durationMs: 3,
      },
      {
        ruleId: 'discovery/tools-list-available',
        title: 'tools list',
        category: 'discovery',
        severity: 'error',
        specVersion: '2025-11-25',
        specRef: 'Server Features §Tools',
        status: 'fail',
        findings: [
          {
            ruleId: 'discovery/tools-list-available',
            severity: 'error',
            message: 'tools/list failed.',
            remediation: 'Implement tools/list.',
            specRef: 'Server Features §Tools',
          },
        ],
        durationMs: 5,
      },
    ],
    summary: { pass: 1, fail: 1, warn: 0, skip: 0, error: 0, total: 2 },
    exitCode: 1,
  };
}

describe('consoleReporter', () => {
  it('groups by category and renders status, remediation, and summary', () => {
    const out = consoleReporter.format(sampleResult());
    expect(out).toContain('initialization');
    expect(out).toContain('discovery');
    expect(out).toContain('[PASS] init/handshake-succeeds');
    expect(out).toContain('[FAIL] discovery/tools-list-available');
    expect(out).toContain('→ Implement tools/list.');
    expect(out).toContain('Summary: 1 pass, 1 fail, 0 warn, 0 error, 0 skip (2 rules)');
    expect(out).toContain('Exit code: 1');
  });
});

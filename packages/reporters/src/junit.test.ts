import type { RunResult } from '@vexyo/core';
import { describe, expect, it } from 'vitest';
import { junitReporter } from './junit';

function sampleResult(): RunResult {
  return {
    outcome: 'completed',
    specVersion: '2025-11-25',
    target: { transport: 'stdio', description: 'stdio: node server.js' },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    results: [
      {
        ruleId: 'init/server-info-name',
        title: 'name',
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
            message: 'tools/list failed with "bad" & <input>',
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

describe('junitReporter', () => {
  const xml = junitReporter.format(sampleResult());

  it('emits a testsuites root with correct counts', () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<testsuites name="vexyo" tests="2" failures="1" errors="0" skipped="0">',
    );
  });

  it('renders one testcase per rule with a <failure> for failures', () => {
    expect(xml).toContain('<testcase name="init/server-info-name" classname="initialization"');
    expect(xml).toContain('<testcase name="discovery/tools-list-available"');
    expect(xml).toContain(
      '<failure message="tools/list failed with &quot;bad&quot; &amp; &lt;input&gt;">',
    );
  });

  it('escapes XML special characters', () => {
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;input&gt;');
    expect(xml).not.toContain('"bad" & <input>'); // raw special chars must not appear
  });
});

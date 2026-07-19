import {
  RegressionDetailSchema,
  type Finding,
  type RegressionDetail,
  type RuleResult,
  type RunResult,
} from '@vexyo/core';
import type { Reporter } from './types';

// Cap detail lists so a catastrophic run can't blow the 1 MB job-summary limit.
const MAX_ITEMS = 50;

/**
 * PR-ready markdown for the GitHub job summary. On green runs it is just the
 * compact overview table. On failing runs it adds a capped "Failures & errors"
 * section (rule id, severity, spec citation, message, remediation — what the
 * console reporter shows), regression drift by class (behavioral before/after
 * collapsed), warnings separately, and a collapsed skipped list. Vertical
 * before/after blocks only — no wide tables — so it reads in a PR without
 * horizontal scroll.
 */
export const markdownReporter: Reporter = {
  name: 'markdown',
  format(result: RunResult): string {
    const conformance = result.results.filter((r) => r.category !== 'regression');
    const regression = result.results.filter((r) => r.category === 'regression');
    const drift = classifyRegression(regression);

    const out: string[] = [];
    out.push(`## vexyo — MCP spec ${result.specVersion}`, '');
    out.push('| Check | Result |', '| --- | --- |');
    out.push(`| Conformance | ${conformanceSummary(conformance)} |`);
    if (regression.length > 0) {
      out.push(`| Schema drift | ${count(drift.schema.length)} |`);
      out.push(`| Behavioral drift | ${count(drift.behavioral.length)} |`);
      out.push(
        `| Coverage drift | ${drift.added.length > 0 ? '⚠️' : '✅'} ${drift.added.length} new · ` +
          `${drift.removed.length > 0 ? '❌' : '✅'} ${drift.removed.length} removed |`,
      );
    }
    out.push('', `**Exit code: ${result.exitCode}**`);

    const failures = conformance
      .filter((r) => r.status === 'fail' || r.status === 'error')
      .flatMap((r) => r.findings);
    const warnings = conformance.filter((r) => r.status === 'warn').flatMap((r) => r.findings);
    const driftItems = [...drift.schema, ...drift.behavioral, ...drift.removed, ...drift.added];
    const skips = conformance.filter((r) => r.status === 'skip' && r.skipReason);

    // Green render is unchanged: overview table + exit code only.
    if (failures.length === 0 && warnings.length === 0 && driftItems.length === 0) {
      return `${out.join('\n').trimEnd()}\n`;
    }

    if (failures.length > 0) {
      out.push('', '### Failures & errors', '', ...capped(failures, renderFinding));
    }
    if (driftItems.length > 0) {
      out.push('', '### Regression drift', '', ...cappedDrift(driftItems));
    }
    if (warnings.length > 0) {
      out.push('', '### Warnings', '', ...capped(warnings, renderFinding));
    }
    if (skips.length > 0) {
      out.push('', ...renderSkips(skips));
    }

    return `${out.join('\n').trimEnd()}\n`;
  },
};

interface DriftItem {
  finding: Finding;
  detail: RegressionDetail;
}

function capped(findings: Finding[], render: (f: Finding) => string[]): string[] {
  const lines = findings.slice(0, MAX_ITEMS).flatMap(render);
  if (findings.length > MAX_ITEMS) {
    lines.push(`- _… ${findings.length - MAX_ITEMS} more — see logs._`);
  }
  return lines;
}

function renderFinding(f: Finding): string[] {
  return [
    `- ${severityIcon(f.severity)} \`${f.ruleId}\` — _${f.severity}_ · ${f.specRef}`,
    `  - ${f.message}`,
    `  - **Fix:** ${f.remediation}`,
  ];
}

function cappedDrift(items: DriftItem[]): string[] {
  const lines: string[] = [];
  for (const item of items.slice(0, MAX_ITEMS)) {
    lines.push(renderDrift(item.finding, item.detail), '');
  }
  if (items.length > MAX_ITEMS) {
    lines.push(`_… ${items.length - MAX_ITEMS} more drift finding(s) — see logs._`);
  }
  return lines;
}

function renderSkips(skips: RuleResult[]): string[] {
  const lines = ['<details>', `<summary>Skipped (${skips.length})</summary>`, ''];
  for (const r of skips.slice(0, MAX_ITEMS)) {
    lines.push(`- \`${r.ruleId}\` — ${r.skipReason ?? ''}`);
  }
  if (skips.length > MAX_ITEMS) {
    lines.push(`- _… ${skips.length - MAX_ITEMS} more — see logs._`);
  }
  lines.push('', '</details>');
  return lines;
}

function classifyRegression(regression: RuleResult[]): {
  schema: DriftItem[];
  behavioral: DriftItem[];
  added: DriftItem[];
  removed: DriftItem[];
} {
  const schema: DriftItem[] = [];
  const behavioral: DriftItem[] = [];
  const added: DriftItem[] = [];
  const removed: DriftItem[] = [];
  for (const result of regression) {
    for (const finding of result.findings) {
      const parsed = RegressionDetailSchema.safeParse(finding.detail);
      if (!parsed.success) {
        continue;
      }
      const item: DriftItem = { finding, detail: parsed.data };
      if (parsed.data.kind === 'schema') {
        schema.push(item);
      } else if (parsed.data.kind === 'behavioral') {
        behavioral.push(item);
      } else if (parsed.data.change === 'added') {
        added.push(item);
      } else {
        removed.push(item);
      }
    }
  }
  return { schema, behavioral, added, removed };
}

function renderDrift(finding: Finding, detail: RegressionDetail): string {
  const icon = severityIcon(finding.severity);
  const header = `#### ${icon} ${detail.kind} drift — ${detail.target.type} \`${detail.target.name}\`${
    detail.target.case ? ` · case \`${detail.target.case}\`` : ''
  }`;
  const lines = [header, ''];

  if (detail.kind === 'schema' && detail.fieldDiffs) {
    for (const d of detail.fieldDiffs) {
      lines.push(
        `\`${d.path}\` changed:`,
        `- **golden:** \`${compact(d.before)}\``,
        `- **live:** \`${compact(d.after)}\``,
        '',
      );
    }
    lines.push(`> ${finding.remediation}`);
  } else if (detail.kind === 'behavioral' && detail.fieldDiffs) {
    lines.push('<details>', '<summary>before / after</summary>', '');
    for (const d of detail.fieldDiffs) {
      lines.push(
        `\`${d.path}\` changed:`,
        '```diff',
        `- ${compact(d.before)}`,
        `+ ${compact(d.after)}`,
        '```',
      );
    }
    lines.push('', '</details>', '', `> ${finding.remediation}`);
  } else {
    lines.push(finding.message, '', `> ${finding.remediation}`);
  }

  return lines.join('\n');
}

function conformanceSummary(results: RuleResult[]): string {
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail' || r.status === 'error').length;
  const icon = fail > 0 ? '❌' : '✅';
  return `${icon} ${pass} passed · ${fail} failed`;
}

function count(n: number): string {
  return n > 0 ? `❌ ${n}` : `✅ ${n}`;
}

function severityIcon(severity: Finding['severity']): string {
  return severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
}

function compact(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return value === undefined ? '(absent)' : JSON.stringify(value);
}

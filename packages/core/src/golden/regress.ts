import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  anyResult,
  promptsListResult,
  resourcesListResult,
  stringField,
  toolsListResult,
} from '../mcp/schemas';
import type { Finding, RuleResult, Severity, SpecVersion } from '../types';
import type { GoldenConfig } from './config';
import { diffValue } from './diff';
import type { GoldenCase, GoldenSet, RegressionDetail, RegressionKind } from './format';
import { suggestNormalizer } from './normalize';
import { buildPipeline, effectivePipelineSpec } from './pipeline';
import { jsonEqual } from './serialize';

const SPEC_REF = 'Regression / Golden set';
type TargetType = 'tool' | 'resource' | 'prompt';

interface LiveSnapshot {
  tools: Record<string, unknown>[];
  resources: Record<string, unknown>[];
  prompts: Record<string, unknown>[];
}

/**
 * Compare the server's current behavior against a committed golden set and
 * return one {@link RuleResult} per drift (plus a `pass` per matching case).
 * Three drift classes, each with its own severity:
 *  - schema     (error):   a definition changed
 *  - behavioral (error):   a recorded call's normalized output changed
 *  - coverage   (error/warn): a golden's target was removed / a live target has no golden
 */
export async function runRegression(
  client: Client,
  golden: GoldenSet,
  cfg: GoldenConfig,
): Promise<RuleResult[]> {
  const specVersion = cfg.specVersion as SpecVersion;
  const live = await snapshotLive(client);
  const results: RuleResult[] = [];

  results.push(...manifestDrift(specVersion, 'tool', 'name', golden.manifest.tools, live.tools));
  results.push(
    ...manifestDrift(specVersion, 'resource', 'uri', golden.manifest.resources, live.resources),
  );
  results.push(
    ...manifestDrift(specVersion, 'prompt', 'name', golden.manifest.prompts, live.prompts),
  );

  const liveToolNames = new Set(
    live.tools.map((t) => stringField(t, 'name')).filter((n): n is string => !!n),
  );
  for (const recording of golden.recordings) {
    if (!liveToolNames.has(recording.tool)) {
      continue; // removal is already reported as coverage drift
    }
    const pipeline = buildPipeline(effectivePipelineSpec(cfg, recording.tool));
    for (const testCase of recording.cases) {
      results.push(await behavioralDrift(client, specVersion, recording.tool, testCase, pipeline));
    }
  }

  return results;
}

/** Schema + coverage drift for one target family (tools / resources / prompts). */
function manifestDrift(
  specVersion: SpecVersion,
  type: TargetType,
  keyField: string,
  goldenDefs: ReadonlyArray<Record<string, unknown>>,
  liveDefs: ReadonlyArray<Record<string, unknown>>,
): RuleResult[] {
  const results: RuleResult[] = [];
  const liveByKey = new Map<string, Record<string, unknown>>();
  for (const def of liveDefs) {
    const key = stringField(def, keyField);
    if (key !== undefined) {
      liveByKey.set(key, def);
    }
  }

  const goldenKeys = new Set<string>();
  for (const def of goldenDefs) {
    const key = stringField(def, keyField);
    if (key === undefined) {
      continue;
    }
    goldenKeys.add(key);
    const liveDef = liveByKey.get(key);
    if (!liveDef) {
      results.push(
        drift(specVersion, 'coverage', 'error', {
          detail: { kind: 'coverage', target: { type, name: key }, change: 'removed', before: def },
          message: `${type} "${key}" has a golden but no longer exists on the server.`,
          remediation:
            'Restore the target, or remove its golden if the removal is intended, then re-record.',
        }),
      );
    } else if (!jsonEqual(def, liveDef)) {
      results.push(
        drift(specVersion, 'schema', 'error', {
          detail: {
            kind: 'schema',
            target: { type, name: key },
            change: 'changed',
            before: def,
            after: liveDef,
            fieldDiffs: diffValue(def, liveDef),
          },
          message: `${type} "${key}" definition changed since the golden was recorded.`,
          remediation: 'Review the change; if intended, re-record with `vexyo record`.',
        }),
      );
    }
  }

  for (const def of liveDefs) {
    const key = stringField(def, keyField);
    if (key === undefined || goldenKeys.has(key)) {
      continue;
    }
    results.push(
      drift(specVersion, 'coverage', 'warning', {
        detail: { kind: 'coverage', target: { type, name: key }, change: 'added', after: def },
        message: `${type} "${key}" exists on the server but has no golden.`,
        remediation: 'Run `vexyo record` to capture it into the golden set.',
      }),
    );
  }

  return results;
}

async function behavioralDrift(
  client: Client,
  specVersion: SpecVersion,
  tool: string,
  testCase: GoldenCase,
  pipeline: (value: unknown) => unknown,
): Promise<RuleResult> {
  let liveNormalized: unknown;
  try {
    const raw = await client.request(
      { method: 'tools/call', params: { name: tool, arguments: testCase.arguments } },
      anyResult,
    );
    liveNormalized = pipeline(raw);
  } catch (err) {
    liveNormalized = pipeline({ error: err instanceof Error ? err.message : String(err) });
  }

  // The stored golden is pipelined too (normalizers are idempotent), so a
  // normalizer or ignore added AFTER recording still applies — no re-record.
  const goldenNormalized = pipeline(testCase.result);
  const fieldDiffs = diffValue(goldenNormalized, liveNormalized);
  if (fieldDiffs.length === 0) {
    return passResult(specVersion, tool, testCase.case);
  }

  const suggested = [...new Set(fieldDiffs.flatMap((d) => suggestNormalizer(d.before, d.after)))];
  const remediation =
    suggested.length > 0
      ? `Field(s) look volatile (${suggested.join(', ')}); add the normalizer(s) for "${tool}", or re-record if the change is real.`
      : 'If the change is intended, re-record with `vexyo record`.';

  return drift(specVersion, 'behavioral', 'error', {
    detail: {
      kind: 'behavioral',
      target: { type: 'tool', name: tool, case: testCase.case },
      change: 'changed',
      before: goldenNormalized,
      after: liveNormalized,
      fieldDiffs,
      suggestedNormalizers: suggested.length > 0 ? suggested : undefined,
    },
    message: `Tool "${tool}" (case "${testCase.case}") output differs from its golden.`,
    remediation,
  });
}

interface DriftSpec {
  detail: RegressionDetail;
  message: string;
  remediation: string;
}

function drift(
  specVersion: SpecVersion,
  kind: RegressionKind,
  severity: Severity,
  spec: DriftSpec,
): RuleResult {
  const { target } = spec.detail;
  const suffix = target.case ? `${target.name}:${target.case}` : target.name;
  const ruleId = `regression/${kind}-drift:${target.type}:${suffix}`;
  const finding: Finding = {
    ruleId,
    severity,
    message: spec.message,
    remediation: spec.remediation,
    specRef: SPEC_REF,
    detail: spec.detail,
  };
  return {
    ruleId,
    title: `${kind} drift — ${target.type} ${target.name}`,
    category: 'regression',
    severity,
    specVersion,
    specRef: SPEC_REF,
    status: severity === 'error' ? 'fail' : 'warn',
    findings: [finding],
    durationMs: 0,
  };
}

function passResult(specVersion: SpecVersion, tool: string, testCase: string): RuleResult {
  return {
    ruleId: `regression/behavioral:${tool}:${testCase}`,
    title: `behavioral — tool ${tool} (case ${testCase})`,
    category: 'regression',
    severity: 'info',
    specVersion,
    specRef: SPEC_REF,
    status: 'pass',
    findings: [],
    durationMs: 0,
  };
}

async function snapshotLive(client: Client): Promise<LiveSnapshot> {
  const caps = client.getServerCapabilities();
  const tools = caps?.tools
    ? (await client.request({ method: 'tools/list', params: {} }, toolsListResult)).tools
    : [];
  const resources = caps?.resources
    ? (await client.request({ method: 'resources/list', params: {} }, resourcesListResult))
        .resources
    : [];
  const prompts = caps?.prompts
    ? (await client.request({ method: 'prompts/list', params: {} }, promptsListResult)).prompts
    : [];
  return { tools, resources, prompts };
}

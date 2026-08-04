import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  anyResult,
  promptsListResult,
  resourcesListResult,
  stringField,
  toolsListResult,
} from '../mcp/schemas';
import type { GoldenConfig } from './config';
import {
  GOLDEN_FORMAT_VERSION,
  type GoldenManifest,
  type GoldenRecording,
  type GoldenSet,
} from './format';
import { buildPipeline, describePipeline, effectivePipelineSpec } from './pipeline';

/**
 * Capture a golden set from a connected server: a schema manifest (always safe —
 * read-only list calls) plus behavioral recordings for the explicitly-configured
 * tools only. A tool absent from `cfg.tools` is never invoked (opt-in per
 * CLAUDE.md side-effect safety).
 */
export async function recordGoldens(client: Client, cfg: GoldenConfig): Promise<GoldenSet> {
  const manifest = await snapshotManifest(client, cfg.specVersion);

  const recordings: GoldenRecording[] = [];
  for (const tool of Object.keys(cfg.tools).sort()) {
    const toolSpec = cfg.tools[tool];
    if (!toolSpec) {
      continue;
    }
    const pipelineSpec = effectivePipelineSpec(cfg, tool);
    const pipeline = buildPipeline(pipelineSpec);
    const pipelineNames = describePipeline(pipelineSpec);
    const cases = [];
    for (const spec of [...toolSpec.cases].sort((a, b) => compare(a.case, b.case))) {
      const raw = await client.request(
        { method: 'tools/call', params: { name: tool, arguments: spec.arguments } },
        anyResult,
      );
      cases.push({
        case: spec.case,
        arguments: spec.arguments,
        normalizers: pipelineNames,
        result: pipeline(raw),
      });
    }
    recordings.push({ formatVersion: GOLDEN_FORMAT_VERSION, tool, cases });
  }

  return { manifest, recordings };
}

async function snapshotManifest(client: Client, specVersion: string): Promise<GoldenManifest> {
  const caps = client.getServerCapabilities();
  const info = client.getServerVersion();

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

  return {
    formatVersion: GOLDEN_FORMAT_VERSION,
    specVersion,
    server: { name: info?.name ?? '', version: info?.version ?? '' },
    tools: sortBy(tools, 'name'),
    resources: sortBy(resources, 'uri'),
    prompts: sortBy(prompts, 'name'),
  };
}

function sortBy(
  items: ReadonlyArray<Record<string, unknown>>,
  key: string,
): Record<string, unknown>[] {
  return [...items].sort((a, b) => compare(stringField(a, key) ?? '', stringField(b, key) ?? ''));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

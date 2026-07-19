import { z } from 'zod';

/**
 * Lax MCP result schemas and small helpers shared by the conformance rules and
 * the regression/golden engine. Both fetch raw responses via
 * `client.request(req, schema)` and validate fields themselves rather than
 * letting the SDK's strict parsing define conformance — so each list entry is
 * an opaque record the caller inspects directly.
 */
export const toolsListResult = z.object({ tools: z.array(z.record(z.string(), z.unknown())) });
export const resourcesListResult = z.object({
  resources: z.array(z.record(z.string(), z.unknown())),
});
export const promptsListResult = z.object({ prompts: z.array(z.record(z.string(), z.unknown())) });

/** Accept any successful result (used when a caller only cares whether it threw). */
export const anyResult = z.unknown();

/** Type guard for a plain object (JSON-RPC result entries). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read a string field from an opaque record, or `undefined` if not a string. */
export function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

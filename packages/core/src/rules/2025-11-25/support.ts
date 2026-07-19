import { z } from 'zod';
import { cleanErrorMessage, errorCode } from '../../mcp/errors';
import {
  isRecord,
  promptsListResult,
  resourcesListResult,
  stringField,
  toolsListResult,
} from '../../mcp/schemas';
import { SkipRule, type RuleContext } from '../../rule';

// Re-export the shared MCP schemas/helpers so rule files keep a single import.
export {
  anyResult,
  isRecord,
  promptsListResult,
  resourcesListResult,
  stringField,
  toolsListResult,
} from '../../mcp/schemas';
export { cleanErrorMessage } from '../../mcp/errors';

/** Just enough of a CallToolResult to read the `isError` signal. */
export const callToolResult = z.object({ isError: z.boolean().optional() });

export interface ErrorInfo {
  threw: boolean;
  code?: number;
  message?: string;
}

/**
 * Normalize a thrown value into `{ code, message }`, unwrapping every
 * `MCP error <code>: ` prefix so the server's original message (which may be
 * empty) is recoverable — required to detect malformed, empty-message error
 * objects and to keep findings free of doubled prefixes.
 */
export function classifyError(err: unknown): ErrorInfo {
  return { threw: true, code: errorCode(err), message: cleanErrorMessage(err) };
}

/**
 * Dependency accessors: a rule that consumes a list operation depends on it. If
 * the operation fails, the dependent rule skips with a reason instead of
 * cascading an error — so one broken `tools/list` reads as one failure (from
 * the rule that directly tests it) plus N skips, not N errors.
 */
export async function requireToolList(ctx: RuleContext): Promise<Record<string, unknown>[]> {
  try {
    return (await ctx.client.request({ method: 'tools/list', params: {} }, toolsListResult)).tools;
  } catch {
    throw new SkipRule('tools/list unavailable');
  }
}

export async function requireResourceList(ctx: RuleContext): Promise<Record<string, unknown>[]> {
  try {
    return (await ctx.client.request({ method: 'resources/list', params: {} }, resourcesListResult))
      .resources;
  } catch {
    throw new SkipRule('resources/list unavailable');
  }
}

export async function requirePromptList(ctx: RuleContext): Promise<Record<string, unknown>[]> {
  try {
    return (await ctx.client.request({ method: 'prompts/list', params: {} }, promptsListResult))
      .prompts;
  } catch {
    throw new SkipRule('prompts/list unavailable');
  }
}

/**
 * Find the first tool whose `inputSchema` declares required parameters, so an
 * argument-validation rule can call it with empty arguments and expect an
 * error. Returns the tool name, or `undefined` if none qualifies.
 */
export function toolWithRequiredParams(
  tools: ReadonlyArray<Record<string, unknown>>,
): string | undefined {
  for (const tool of tools) {
    const name = stringField(tool, 'name');
    const schema = tool['inputSchema'];
    if (
      name &&
      isRecord(schema) &&
      Array.isArray(schema['required']) &&
      schema['required'].length > 0
    ) {
      return name;
    }
  }
  return undefined;
}

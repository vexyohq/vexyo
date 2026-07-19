import { finding, SkipRule, type Rule } from '../../../rule';
import { callToolResult } from '../support';

const NONEXISTENT_TOOL = '__vexyo_nonexistent_tool__';

/**
 * Calling a tool that does not exist must be signalled as an error — either a
 * JSON-RPC error or a result with `isError: true`. Both are spec-legitimate, so
 * we accept either (see docs/spec-ambiguities.md). A plain success result is the
 * defect: the model would treat a no-op as if the tool ran.
 */
export const unknownTool: Rule = {
  id: 'errors/unknown-tool',
  specVersion: '2025-11-25',
  category: 'error-semantics',
  severity: 'error',
  title: 'Calling an unknown tool is signalled as an error',
  specRef: 'Server Features §Tools / Calling Tools (error handling)',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    try {
      const result = await ctx.client.request(
        { method: 'tools/call', params: { name: NONEXISTENT_TOOL, arguments: {} } },
        callToolResult,
      );
      if (result.isError === true) {
        return [];
      }
      return [
        finding(
          this,
          'Calling a nonexistent tool returned a successful result instead of an error.',
          'Return a JSON-RPC error or a result with `isError: true` for unknown tool names.',
          result,
        ),
      ];
    } catch {
      // JSON-RPC error response — the acceptable alternative.
      return [];
    }
  },
};

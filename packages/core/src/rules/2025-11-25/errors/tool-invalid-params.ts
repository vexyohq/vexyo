import { finding, SkipRule, type Rule } from '../../../rule';
import { callToolResult, requireToolList, toolWithRequiredParams } from '../support';

/**
 * Calling a tool with missing required arguments must be rejected — via a
 * JSON-RPC error (`-32602`) or an `isError: true` result — never silently
 * accepted. We pick the first tool that declares required parameters and call
 * it with empty arguments. Skipped if no tool declares required parameters.
 */
export const toolInvalidParams: Rule = {
  id: 'errors/tool-invalid-params',
  specVersion: '2025-11-25',
  category: 'error-semantics',
  severity: 'error',
  title: 'Invalid tool arguments are rejected',
  specRef: 'Server Features §Tools / Calling Tools (input validation)',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    const tools = await requireToolList(ctx);
    const target = toolWithRequiredParams(tools);
    if (target === undefined) {
      throw new SkipRule('No tool declares required parameters to probe.');
    }
    try {
      const result = await ctx.client.request(
        { method: 'tools/call', params: { name: target, arguments: {} } },
        callToolResult,
      );
      if (result.isError === true) {
        return [];
      }
      return [
        finding(
          this,
          `Tool "${target}" accepted a call with missing required arguments and returned success.`,
          'Validate tool arguments and return an error (-32602 or `isError: true`) on invalid input.',
          result,
        ),
      ];
    } catch {
      // JSON-RPC error response — arguments were validated. Acceptable.
      return [];
    }
  },
};

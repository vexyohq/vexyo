import { finding, SkipRule, type Rule } from '../../../rule';
import { cleanErrorMessage, toolsListResult } from '../support';

/**
 * A server that advertises the `tools` capability must answer `tools/list` with
 * a well-formed `{ tools: [...] }` result. If the capability was never
 * advertised the check is not applicable and is skipped.
 */
export const toolsListAvailable: Rule = {
  id: 'discovery/tools-list-available',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'tools/list responds with a tool array',
  specRef: 'Server Features §Tools / Listing Tools',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    try {
      await ctx.client.request({ method: 'tools/list', params: {} }, toolsListResult);
      return [];
    } catch (err) {
      return [
        finding(
          this,
          '`tools/list` failed despite the `tools` capability being advertised.',
          'Implement `tools/list` to return `{ tools: Tool[] }`, or stop advertising the `tools` capability.',
          { error: cleanErrorMessage(err) },
        ),
      ];
    }
  },
};

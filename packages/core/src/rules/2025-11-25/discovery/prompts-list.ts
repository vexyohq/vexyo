import { finding, SkipRule, type Rule } from '../../../rule';
import { cleanErrorMessage, promptsListResult } from '../support';

/**
 * A server advertising the `prompts` capability must answer `prompts/list` with
 * a `{ prompts: [...] }` result. Skipped when the capability is absent.
 */
export const promptsListAvailable: Rule = {
  id: 'discovery/prompts-list-available',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'prompts/list responds with a prompt array',
  specRef: 'Server Features §Prompts / Listing Prompts',
  async run(ctx) {
    if (!ctx.capabilities?.prompts) {
      throw new SkipRule('Server does not advertise the `prompts` capability.');
    }
    try {
      await ctx.client.request({ method: 'prompts/list', params: {} }, promptsListResult);
      return [];
    } catch (err) {
      return [
        finding(
          this,
          '`prompts/list` failed despite the `prompts` capability being advertised.',
          'Implement `prompts/list`, or stop advertising the `prompts` capability.',
          { error: cleanErrorMessage(err) },
        ),
      ];
    }
  },
};

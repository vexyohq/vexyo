import { finding, SkipRule, type Rule } from '../../../rule';
import { cleanErrorMessage, resourcesListResult } from '../support';

/**
 * A server advertising the `resources` capability must answer `resources/list`
 * with a `{ resources: [...] }` result. Skipped when the capability is absent.
 */
export const resourcesListAvailable: Rule = {
  id: 'discovery/resources-list-available',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'resources/list responds with a resource array',
  specRef: 'Server Features §Resources / Listing Resources',
  async run(ctx) {
    if (!ctx.capabilities?.resources) {
      throw new SkipRule('Server does not advertise the `resources` capability.');
    }
    try {
      await ctx.client.request({ method: 'resources/list', params: {} }, resourcesListResult);
      return [];
    } catch (err) {
      return [
        finding(
          this,
          '`resources/list` failed despite the `resources` capability being advertised.',
          'Implement `resources/list`, or stop advertising the `resources` capability.',
          { error: cleanErrorMessage(err) },
        ),
      ];
    }
  },
};

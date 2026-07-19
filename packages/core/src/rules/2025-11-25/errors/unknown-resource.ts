import { finding, SkipRule, type Rule } from '../../../rule';
import { anyResult } from '../support';

const NONEXISTENT_URI = 'vexyo://__vexyo_nonexistent_resource__';

/**
 * Reading a resource URI the server does not serve must be an error, not an
 * empty success. A silent empty read looks to the model like the resource
 * exists but is blank.
 */
export const unknownResource: Rule = {
  id: 'errors/unknown-resource',
  specVersion: '2025-11-25',
  category: 'error-semantics',
  severity: 'error',
  title: 'Reading an unknown resource returns an error',
  specRef: 'Server Features §Resources / Reading Resources (error handling)',
  async run(ctx) {
    if (!ctx.capabilities?.resources) {
      throw new SkipRule('Server does not advertise the `resources` capability.');
    }
    try {
      await ctx.client.request(
        { method: 'resources/read', params: { uri: NONEXISTENT_URI } },
        anyResult,
      );
      return [
        finding(
          this,
          'Reading a nonexistent resource URI returned a successful result instead of an error.',
          'Return a JSON-RPC error for resource URIs the server does not serve.',
        ),
      ];
    } catch {
      return [];
    }
  },
};

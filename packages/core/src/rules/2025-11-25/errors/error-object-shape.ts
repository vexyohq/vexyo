import { finding, SkipRule, type Rule } from '../../../rule';
import { anyResult, classifyError } from '../support';

const NONEXISTENT_URI = 'vexyo://__vexyo_error_shape_probe__';

/**
 * When a server returns a JSON-RPC error, the error object must be well-formed:
 * a numeric `code` and a non-empty `message`. We trigger a reliable JSON-RPC
 * error — reading a resource the server does not serve — and inspect the
 * resulting error object. (Tool argument errors are excluded here because a
 * compliant server may legitimately signal them via an `isError` result rather
 * than a JSON-RPC error, which leaves no error object to assess.)
 */
export const errorObjectShape: Rule = {
  id: 'errors/error-object-shape',
  specVersion: '2025-11-25',
  category: 'error-semantics',
  severity: 'error',
  title: 'JSON-RPC error objects carry a numeric code and non-empty message',
  specRef: 'Base Protocol §JSON-RPC / Error object',
  async run(ctx) {
    if (!ctx.capabilities?.resources) {
      throw new SkipRule('Server does not advertise the `resources` capability.');
    }
    try {
      await ctx.client.request(
        { method: 'resources/read', params: { uri: NONEXISTENT_URI } },
        anyResult,
      );
      // A compliant server errors on an unknown resource; if it succeeds there
      // is no error object to assess (that gap is covered by errors/unknown-resource).
      throw new SkipRule('Server did not raise a JSON-RPC error for an unknown resource.');
    } catch (err) {
      if (err instanceof SkipRule) {
        throw err;
      }
      const info = classifyError(err);
      const problems: string[] = [];
      if (typeof info.code !== 'number') {
        problems.push('missing numeric `code`');
      }
      if (info.message === undefined || info.message.length === 0) {
        problems.push('missing or empty `message`');
      }
      if (problems.length > 0) {
        return [
          finding(
            this,
            `JSON-RPC error object is malformed: ${problems.join(', ')}.`,
            'Every JSON-RPC error must include a numeric `code` and a non-empty `message`.',
            info,
          ),
        ];
      }
      return [];
    }
  },
};

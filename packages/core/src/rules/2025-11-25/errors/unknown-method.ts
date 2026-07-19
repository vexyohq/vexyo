import { ErrorCode, type ClientRequest } from '@modelcontextprotocol/sdk/types.js';
import { finding, type Rule } from '../../../rule';
import { anyResult, classifyError } from '../support';

/**
 * A request for a method the server does not implement must be answered with a
 * JSON-RPC `-32601` (Method not found), not a bogus success. We probe a
 * deliberately unknown method — a conformance probe, which CLAUDE.md hard rule
 * #1 permits inside a rule. The request is cast because an unknown method is,
 * by definition, not part of the typed `ClientRequest` union.
 */
const PROBE_UNSUPPORTED_METHOD = 'vexyo/probe-unsupported-method';

export const unknownMethod: Rule = {
  id: 'errors/unknown-method',
  specVersion: '2025-11-25',
  category: 'error-semantics',
  severity: 'error',
  title: 'Unknown methods return -32601 (Method not found)',
  specRef: 'Base Protocol §JSON-RPC / Error codes',
  async run(ctx) {
    const probe = { method: PROBE_UNSUPPORTED_METHOD, params: {} } as unknown as ClientRequest;
    try {
      await ctx.client.request(probe, anyResult);
      return [
        finding(
          this,
          'An unknown method returned a result instead of an error.',
          'Return JSON-RPC error -32601 (Method not found) for methods the server does not implement.',
        ),
      ];
    } catch (err) {
      const info = classifyError(err);
      if (info.code === ErrorCode.MethodNotFound) {
        return [];
      }
      return [
        finding(
          this,
          `Unknown method returned error code ${info.code ?? '(none)'}, expected -32601 (Method not found).`,
          'Return JSON-RPC error -32601 for methods the server does not implement.',
          info,
        ),
      ];
    }
  },
};

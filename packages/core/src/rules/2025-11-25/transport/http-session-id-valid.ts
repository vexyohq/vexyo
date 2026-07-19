import { finding, SkipRule, type Rule } from '../../../rule';

// Streamable HTTP session ids must contain only visible ASCII (0x21–0x7E).
const VISIBLE_ASCII = /^[\x21-\x7e]+$/;

/**
 * When connected over Streamable HTTP and the server operates statefully (it
 * issued an `Mcp-Session-Id`), that id must contain only visible ASCII
 * characters per the spec. Skipped over stdio and for stateless HTTP servers
 * (statelessness is spec-valid) — so this rule only fires on a genuine
 * violation.
 */
export const httpSessionIdValid: Rule = {
  id: 'transport/http-session-id-valid',
  specVersion: '2025-11-25',
  category: 'transport',
  severity: 'error',
  title: 'HTTP session id contains only visible ASCII',
  specRef: 'Transports §Streamable HTTP / Session management',
  async run(ctx) {
    if (ctx.transport.kind !== 'http') {
      throw new SkipRule('Not an HTTP connection.');
    }
    const sessionId = ctx.transport.sessionId;
    if (sessionId === undefined) {
      throw new SkipRule('Server operates statelessly (no Mcp-Session-Id issued).');
    }
    if (!VISIBLE_ASCII.test(sessionId)) {
      return [
        finding(
          this,
          'The issued Mcp-Session-Id contains characters outside visible ASCII (0x21–0x7E).',
          'Generate session ids using only visible ASCII characters (e.g. a UUID).',
          { sessionId },
        ),
      ];
    }
    return [];
  },
};

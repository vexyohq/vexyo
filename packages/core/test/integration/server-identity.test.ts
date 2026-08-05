import { describe, expect, it } from 'vitest';
import { runSuite } from '../../src/runner';
import { compliantFixture, SPEC, type Transport } from '../support/harness';

/**
 * Server identity must be captured from the existing initialize exchange over
 * BOTH transports. Version assertions are deliberately format-based, never a
 * hardcoded protocol string: what the SDK negotiates is the SDK's business.
 */
describe.each<Transport>(['stdio', 'http'])('server identity over %s', (transport) => {
  it('lands on RunResult with all four fields', async () => {
    const fx = await compliantFixture(transport);
    try {
      const result = await runSuite({ specVersion: SPEC, target: fx.target });
      expect(result.server.negotiatedProtocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.server.serverInfo.name).toBe('vexyo-compliant-fixture');
      expect(result.server.serverInfo.version).toBe('1.0.0');
      expect(Object.keys(result.server.capabilities)).toContain('tools');
      expect(result.server.instructions).toBe(
        'A reference-compliant MCP server used to validate vexyo conformance rules.',
      );
    } finally {
      await fx.stop();
    }
  });
});

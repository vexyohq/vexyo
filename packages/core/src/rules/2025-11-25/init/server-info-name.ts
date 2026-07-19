import { finding, type Rule } from '../../../rule';

/**
 * Initialization must identify the server with a non-empty name. The SDK
 * completes the handshake before rules run, so `serverInfo` is available; a
 * missing or empty name is a conformance defect the SDK tolerates but the spec
 * forbids.
 */
export const serverInfoName: Rule = {
  id: 'init/server-info-name',
  specVersion: '2025-11-25',
  category: 'initialization',
  severity: 'error',
  title: 'Server advertises a non-empty serverInfo.name',
  specRef: 'Base Protocol §Lifecycle / Initialization (serverInfo)',
  async run(ctx) {
    const name = ctx.serverInfo?.name;
    if (typeof name !== 'string' || name.length === 0) {
      return [
        finding(
          this,
          'Server did not return a non-empty `serverInfo.name` during initialization.',
          'Return a non-empty `serverInfo.name` in the initialize response.',
          { serverInfo: ctx.serverInfo },
        ),
      ];
    }
    return [];
  },
};

import { finding, type Rule } from '../../../rule';

/**
 * The spec requires `serverInfo.version` alongside the name. The SDK schema
 * allows an empty string; the spec expects a meaningful version identifier.
 */
export const serverInfoVersion: Rule = {
  id: 'init/server-info-version',
  specVersion: '2025-11-25',
  category: 'initialization',
  severity: 'error',
  title: 'Server advertises a non-empty serverInfo.version',
  specRef: 'Base Protocol §Lifecycle / Initialization (serverInfo)',
  async run(ctx) {
    const version = ctx.serverInfo?.version;
    if (typeof version !== 'string' || version.length === 0) {
      return [
        finding(
          this,
          'Server did not return a non-empty `serverInfo.version` during initialization.',
          'Return a non-empty `serverInfo.version` in the initialize response.',
          { serverInfo: ctx.serverInfo },
        ),
      ];
    }
    return [];
  },
};

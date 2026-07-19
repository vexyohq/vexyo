import { describe, expect, it } from 'vitest';
import { runSuite } from '../../src/index';
import { brokenFixture, SPEC } from '../support/harness';

describe('rule-dependency skip semantics', () => {
  it('a broken tools/list renders as ONE failure + N skips, never errors', async () => {
    const fixture = await brokenFixture('stdio', 'discovery', 'tools-list-throws');
    try {
      const result = await runSuite({ specVersion: SPEC, target: fixture.target });

      // Exactly one failure: the rule that directly tests tools/list.
      const failed = result.results.filter((r) => r.status === 'fail');
      expect(failed.map((r) => r.ruleId)).toEqual(['discovery/tools-list-available']);

      // No rule errors — every tools/list dependent skips instead of cascading.
      expect(result.summary.error).toBe(0);

      // The dependents skip with a reason that names the missing prerequisite.
      const depSkips = result.results.filter(
        (r) => r.status === 'skip' && r.skipReason === 'tools/list unavailable',
      );
      expect(depSkips.map((r) => r.ruleId).sort()).toEqual([
        'discovery/tool-names-unique',
        'discovery/tools-have-input-schema',
        'discovery/tools-have-names',
        'errors/tool-invalid-params',
      ]);
    } finally {
      await fixture.stop();
    }
  });
});

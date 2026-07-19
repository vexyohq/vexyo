import { describe, expect, it } from 'vitest';
import { runSuite } from '../../src/index';
import {
  errorObjectShape,
  promptsHaveNames,
  promptsListAvailable,
  resourcesHaveUri,
  resourcesListAvailable,
  serverInfoName,
  serverInfoVersion,
  toolInvalidParams,
  toolNamesUnique,
  toolsHaveInputSchema,
  toolsHaveNames,
  toolsListAvailable,
  unknownMethod,
  unknownResource,
  unknownTool,
} from '../../src/rules/2025-11-25/index';
import {
  brokenFixture,
  compliantFixture,
  runRule,
  SPEC,
  type BrokenFamily,
  type Transport,
} from '../support/harness';

const TRANSPORTS: Transport[] = ['stdio', 'http'];

// Each transport-agnostic rule + the dedicated broken fixture defect it detects.
const BROKEN_CASES: Array<{ rule: typeof serverInfoName; family: BrokenFamily; defect: string }> = [
  { rule: serverInfoName, family: 'initialization', defect: 'name-empty' },
  { rule: serverInfoVersion, family: 'initialization', defect: 'version-empty' },
  { rule: toolsListAvailable, family: 'discovery', defect: 'tools-list-throws' },
  { rule: toolsHaveNames, family: 'discovery', defect: 'tool-empty-name' },
  { rule: toolsHaveInputSchema, family: 'discovery', defect: 'tool-missing-schema' },
  { rule: toolNamesUnique, family: 'discovery', defect: 'tool-duplicate-name' },
  { rule: resourcesListAvailable, family: 'discovery', defect: 'resources-list-throws' },
  { rule: resourcesHaveUri, family: 'discovery', defect: 'resource-empty-uri' },
  { rule: promptsListAvailable, family: 'discovery', defect: 'prompts-list-throws' },
  { rule: promptsHaveNames, family: 'discovery', defect: 'prompt-empty-name' },
  { rule: unknownMethod, family: 'error-semantics', defect: 'unknown-method-ok' },
  { rule: unknownTool, family: 'error-semantics', defect: 'unknown-tool-ok' },
  { rule: toolInvalidParams, family: 'error-semantics', defect: 'invalid-params-ok' },
  { rule: unknownResource, family: 'error-semantics', defect: 'unknown-resource-ok' },
  { rule: errorObjectShape, family: 'error-semantics', defect: 'empty-error-message' },
];

// Transport is a matrix dimension, not a fork: the full rule set runs over both.
describe.each(TRANSPORTS)('conformance over %s', (transport) => {
  it('compliant fixture: the full suite has no failures or errors', async () => {
    const fixture = await compliantFixture(transport);
    try {
      const result = await runSuite({ specVersion: SPEC, target: fixture.target });
      expect(result.summary.fail, JSON.stringify(result.summary)).toBe(0);
      expect(result.summary.error).toBe(0);
      // All 15 transport-agnostic rules pass on every transport.
      expect(result.summary.pass).toBeGreaterThanOrEqual(15);
    } finally {
      await fixture.stop();
    }
  });

  for (const { rule, family, defect } of BROKEN_CASES) {
    it(`${rule.id}: fails broken(${defect})`, async () => {
      const fixture = await brokenFixture(transport, family, defect);
      try {
        const result = await runRule(rule, fixture.target);
        expect(result.status, `expected fail, got ${result.status}`).toBe('fail');
      } finally {
        await fixture.stop();
      }
    });
  }
});

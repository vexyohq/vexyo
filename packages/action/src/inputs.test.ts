import { describe, expect, it } from 'vitest';
import { parseInputs } from './inputs';

describe('parseInputs', () => {
  it('coerces the regression string to a boolean and defaults it to false', () => {
    expect(parseInputs({ config: 'c.ts' }).regression).toBe(false);
    expect(parseInputs({ config: 'c.ts', regression: 'true' }).regression).toBe(true);
    expect(parseInputs({ config: 'c.ts', regression: 'false' }).regression).toBe(false);
  });

  it('accepts optional spec-version, fail-on, and junit-file', () => {
    const inputs = parseInputs({
      config: 'c.ts',
      specVersion: '2025-11-25',
      failOn: 'warning',
      junitFile: 'out.xml',
    });
    expect(inputs.specVersion).toBe('2025-11-25');
    expect(inputs.failOn).toBe('warning');
    expect(inputs.junitFile).toBe('out.xml');
  });

  it('rejects a missing config', () => {
    expect(() => parseInputs({ config: '' })).toThrow();
  });

  it('rejects an invalid fail-on', () => {
    expect(() => parseInputs({ config: 'c.ts', failOn: 'loud' })).toThrow();
  });
});

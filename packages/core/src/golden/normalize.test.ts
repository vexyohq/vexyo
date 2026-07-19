import { describe, expect, it } from 'vitest';
import { applyNormalizers, BUILTIN_NORMALIZER_NAMES, suggestNormalizer } from './normalize';

describe('applyNormalizers', () => {
  it('collapses ISO timestamps and UUIDs to placeholders', () => {
    const out = applyNormalizers(
      {
        content: [{ text: 'at 2026-07-18T12:00:00.000Z id 123e4567-e89b-12d3-a456-426614174000' }],
      },
      ['iso-timestamp', 'uuid'],
    );
    const json = JSON.stringify(out);
    expect(json).toContain('<timestamp>');
    expect(json).toContain('<uuid>');
  });

  it('collapses epoch-millis integers when opted in', () => {
    expect(applyNormalizers({ t: 1_700_000_000_000 }, ['epoch-millis'])).toEqual({ t: '<epoch>' });
  });

  it('applies an inline custom normalizer object', () => {
    const out = applyNormalizers({ token: 'secret' }, [
      {
        name: 'redact',
        apply: (v) => JSON.parse(JSON.stringify(v).replace('secret', '<redacted>')),
      },
    ]);
    expect(out).toEqual({ token: '<redacted>' });
  });

  it('throws a clear error for an unknown builtin', () => {
    expect(() => applyNormalizers({}, ['nope'])).toThrow(/Unknown normalizer/);
  });

  it('exposes builtin names', () => {
    expect(BUILTIN_NORMALIZER_NAMES).toContain('uuid');
    expect(BUILTIN_NORMALIZER_NAMES).toContain('iso-timestamp');
  });
});

describe('suggestNormalizer', () => {
  it('suggests a normalizer when both sides match the same volatile pattern', () => {
    expect(suggestNormalizer('2026-01-01T00:00:00Z', '2026-02-02T00:00:00Z')).toContain(
      'iso-timestamp',
    );
  });

  it('suggests nothing for a plain textual change', () => {
    expect(suggestNormalizer('hello', 'world')).toEqual([]);
  });
});

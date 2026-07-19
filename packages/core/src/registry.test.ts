import { describe, expect, it } from 'vitest';
import { allRules, rulesForSpecVersion } from './registry';

describe('registry', () => {
  it('returns at least 15 rules for the stable spec version, all tagged to it', () => {
    const rules = rulesForSpecVersion('2025-11-25');
    expect(rules.length).toBeGreaterThanOrEqual(15);
    expect(rules.every((rule) => rule.specVersion === '2025-11-25')).toBe(true);
  });

  it('covers initialization, discovery, error-semantics, and transport families', () => {
    const categories = new Set(rulesForSpecVersion('2025-11-25').map((rule) => rule.category));
    expect(categories).toContain('initialization');
    expect(categories).toContain('discovery');
    expect(categories).toContain('error-semantics');
    expect(categories).toContain('transport');
  });

  it('returns an empty set for a version with no wired-up rules', () => {
    expect(rulesForSpecVersion('2026-07-28')).toEqual([]);
  });

  it('gives every rule a unique id', () => {
    const ids = allRules().map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

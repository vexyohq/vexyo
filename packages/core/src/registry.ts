import type { Rule } from './rule';
import type { SpecVersion } from './types';
import { rules2025_11_25 } from './rules/2025-11-25/index';

/**
 * The complete rule catalog. Rules are grouped by spec version at the source
 * level and never merged across versions (CLAUDE.md hard rule #2).
 */
const ALL_RULES: readonly Rule[] = [...rules2025_11_25];

/** Rules that target the given spec version, in registration order. */
export function rulesForSpecVersion(version: SpecVersion): Rule[] {
  return ALL_RULES.filter((rule) => rule.specVersion === version);
}

/** The full catalog (all versions) — used for introspection/tests. */
export function allRules(): readonly Rule[] {
  return ALL_RULES;
}

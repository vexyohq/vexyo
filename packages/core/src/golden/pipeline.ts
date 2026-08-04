import type { GoldenConfig } from './config';
import { applyNormalizers, normalizerName, type NormalizerRef } from './normalize';
import { applyAtPath, parsePath, type PathSegment } from './path';
import { compareJsonValues } from './sort';

/**
 * The normalization pipeline a tool's results pass through — identically at
 * record and compare time, so a normalized or ignored field can never drift:
 *   1. whole-tree normalizers, in order (existing behavior),
 *   2. path-scoped normalizers, in declaration order,
 *   3. sortArrays paths — AFTER all value normalization, so volatile fields
 *      are already collapsed and sort order can't depend on them,
 *   4. ignored paths, LAST — which is what guarantees "ignore beats normalize"
 *      (and beats sort; index-targeted ignores refer to post-sort positions).
 */

/** Ignored subtrees are collapsed to this literal on both sides of the diff. */
export const IGNORED_PLACEHOLDER = '<ignored>';

export interface PipelineSpec {
  /** Whole-tree normalizers, applied in order. */
  normalizers: readonly NormalizerRef[];
  /** Path-scoped normalizers, applied to the subtree at each path. */
  paths: Readonly<Record<string, NormalizerRef | readonly NormalizerRef[]>>;
  /** Paths whose array's order is not significant — sorted deterministically. */
  sortArrays: readonly string[];
  /** Paths excluded from comparison entirely (collapsed to a placeholder). */
  ignore: readonly string[];
}

/**
 * The pipeline spec in effect for one tool: per-tool settings replace the
 * defaults per key independently (same `??` semantics `normalizers` always had).
 */
export function effectivePipelineSpec(cfg: GoldenConfig, tool: string): PipelineSpec {
  const spec = cfg.tools[tool];
  return {
    normalizers: spec?.normalizers ?? cfg.defaultNormalizers,
    paths: spec?.paths ?? cfg.defaultPaths,
    sortArrays: spec?.sortArrays ?? cfg.defaultSortArrays,
    ignore: spec?.ignore ?? cfg.defaultIgnore,
  };
}

interface ScopedRule {
  segments: PathSegment[];
  refs: readonly NormalizerRef[];
}

function toRefList(refs: NormalizerRef | readonly NormalizerRef[]): readonly NormalizerRef[] {
  return Array.isArray(refs) ? refs : [refs as NormalizerRef];
}

/**
 * Build the composed pipeline function. Paths are parsed once, up front, so a
 * syntax error surfaces immediately (the CLI already rejects bad paths at
 * config load; this guards direct core callers).
 */
/** Sort the array at a path; anything else is an identity no-op. */
function sortIfArray(value: unknown): unknown {
  return Array.isArray(value) ? [...value].sort(compareJsonValues) : value;
}

export function buildPipeline(spec: PipelineSpec): (value: unknown) => unknown {
  const scoped: ScopedRule[] = Object.entries(spec.paths).map(([path, refs]) => ({
    segments: parsePath(path),
    refs: toRefList(refs),
  }));
  // Inner paths sort before outer ones (stable, by depth descending): an outer
  // sort compares canonicalized children, so children must already be in final
  // order. Harmless for any correct config — disjoint paths commute.
  const sortRules: PathSegment[][] = spec.sortArrays
    .map((path) => parsePath(path))
    .sort((a, b) => b.length - a.length);
  const ignored: PathSegment[][] = spec.ignore.map((path) => parsePath(path));

  return (value) => {
    let out = applyNormalizers(value, spec.normalizers);
    for (const rule of scoped) {
      out = applyAtPath(out, rule.segments, (subtree) => applyNormalizers(subtree, rule.refs));
    }
    for (const segments of sortRules) {
      out = applyAtPath(out, segments, sortIfArray);
    }
    for (const segments of ignored) {
      out = applyAtPath(out, segments, () => IGNORED_PLACEHOLDER);
    }
    return out;
  };
}

/**
 * Human-readable names for `GoldenCase.normalizers` (reference only — never
 * read back): `['uuid', 'hex-id @ items[*].id', 'ignore @ meta.elapsedMs']`.
 */
export function describePipeline(spec: PipelineSpec): string[] {
  return [
    ...spec.normalizers.map(normalizerName),
    ...Object.entries(spec.paths).flatMap(([path, refs]) =>
      toRefList(refs).map((ref) => `${normalizerName(ref)} @ ${path}`),
    ),
    ...spec.sortArrays.map((path) => `sort-arrays @ ${path}`),
    ...spec.ignore.map((path) => `ignore @ ${path}`),
  ];
}

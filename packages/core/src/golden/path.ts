/**
 * Result-path grammar for scoping normalizers and ignores: dot keys, bracket
 * indices, and an array wildcard — `content[0].text`, `items[*].id`, `[*].name`.
 * Deliberately identical to the `FieldDiff.path` strings the drift reporter
 * prints, so a path can be copied from a drift report straight into config.
 * No deep wildcard (`**`) and no quoted keys; keys containing `.` or `[` are
 * unreachable — the whole-result custom normalizer remains the escape hatch.
 */

export type PathSegment =
  { kind: 'key'; key: string } | { kind: 'index'; index: number } | { kind: 'wildcard' };

function invalid(path: string, detail: string): Error {
  return new Error(
    `Invalid result path "${path}": ${detail}. Expected dot/bracket syntax like "content[0].text" or "items[*].id".`,
  );
}

/** Parse a result path into segments. Throws with a user-facing message on bad syntax. */
export function parsePath(path: string): PathSegment[] {
  if (path === '' || path === '(root)') {
    throw new Error(
      `Path "${path}" refers to the whole result — use a whole-result normalizer instead of a path rule.`,
    );
  }
  const segments: PathSegment[] = [];
  let i = 0;
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      throw invalid(
        path,
        i === 0 ? 'a path cannot start with "."' : 'empty key (consecutive dots)',
      );
    }
    if (ch === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) {
        throw invalid(path, `unclosed "[" at position ${i}`);
      }
      const inner = path.slice(i + 1, end);
      if (inner === '*') {
        segments.push({ kind: 'wildcard' });
      } else if (/^\d+$/.test(inner)) {
        segments.push({ kind: 'index', index: Number(inner) });
      } else {
        throw invalid(path, `expected an array index or "*" inside "[...]", got "${inner}"`);
      }
      i = end + 1;
    } else {
      let j = i;
      while (j < path.length && path[j] !== '.' && path[j] !== '[') {
        j += 1;
      }
      segments.push({ kind: 'key', key: path.slice(i, j) });
      i = j;
    }
    if (i < path.length) {
      if (path[i] === '.') {
        i += 1;
        if (i === path.length) {
          throw invalid(path, 'trailing "."');
        }
        if (path[i] === '[' || path[i] === '.') {
          throw invalid(path, `unexpected "${path[i]}" after "." at position ${i}`);
        }
      } else if (path[i] !== '[') {
        throw invalid(path, `expected "." or "[" after "]" at position ${i}`);
      }
    }
  }
  return segments;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Apply `fn` to the value(s) at `segments` within `tree`, returning a new tree.
 * Immutable: the input is never mutated, and an unmatched path (missing key,
 * out-of-bounds index, or a segment-kind/value mismatch) returns the input
 * tree unchanged — by identity, so callers can detect a no-op with `===`.
 */
export function applyAtPath(
  tree: unknown,
  segments: readonly PathSegment[],
  fn: (value: unknown) => unknown,
): unknown {
  return step(tree, segments, 0, fn);
}

function step(
  tree: unknown,
  segments: readonly PathSegment[],
  depth: number,
  fn: (value: unknown) => unknown,
): unknown {
  if (depth === segments.length) {
    return fn(tree);
  }
  const segment = segments[depth] as PathSegment;

  if (segment.kind === 'key') {
    if (!isPlainObject(tree) || !Object.hasOwn(tree, segment.key)) {
      return tree;
    }
    const next = step(tree[segment.key], segments, depth + 1, fn);
    if (next === tree[segment.key]) {
      return tree;
    }
    return { ...tree, [segment.key]: next };
  }

  if (segment.kind === 'index') {
    if (!Array.isArray(tree) || segment.index >= tree.length) {
      return tree;
    }
    const next = step(tree[segment.index], segments, depth + 1, fn);
    if (next === tree[segment.index]) {
      return tree;
    }
    const copy = [...tree];
    copy[segment.index] = next;
    return copy;
  }

  // wildcard
  if (!Array.isArray(tree)) {
    return tree;
  }
  const mapped = tree.map((item) => step(item, segments, depth + 1, fn));
  return mapped.every((item, index) => item === tree[index]) ? tree : mapped;
}

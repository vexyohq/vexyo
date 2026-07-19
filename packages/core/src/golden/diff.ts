import { jsonEqual } from './serialize';
import type { FieldDiff } from './format';
import { isRecord } from '../mcp/schemas';

/**
 * Structural JSON diff producing field-level before/after pairs keyed by a
 * JSON-path-ish string (`content[0].text`). Used to point a user at the exact
 * unstable field so they can add a normalizer rather than blindly re-record.
 */
export function diffValue(before: unknown, after: unknown, path = ''): FieldDiff[] {
  if (jsonEqual(before, after)) {
    return [];
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => diffValue(before[key], after[key], join(path, key)));
  }

  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    return before.flatMap((item, i) => diffValue(item, after[i], `${path}[${i}]`));
  }

  return [{ path: path || '(root)', before, after }];
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

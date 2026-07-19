import { describe, expect, it } from 'vitest';
import { diffValue } from './diff';

describe('diffValue', () => {
  it('returns no diffs for equal values', () => {
    expect(diffValue({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('reports nested field paths (JSON-path-ish)', () => {
    const diffs = diffValue({ content: [{ text: 'a' }] }, { content: [{ text: 'b' }] });
    expect(diffs).toEqual([{ path: 'content[0].text', before: 'a', after: 'b' }]);
  });

  it('reports an added key', () => {
    expect(diffValue({ a: 1 }, { a: 1, b: 2 })).toEqual([
      { path: 'b', before: undefined, after: 2 },
    ]);
  });

  it('treats different-length arrays as a single leaf diff', () => {
    expect(diffValue({ xs: [1] }, { xs: [1, 2] })).toEqual([
      { path: 'xs', before: [1], after: [1, 2] },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { applyAtPath, parsePath } from './path';

describe('parsePath', () => {
  it('parses dot keys', () => {
    expect(parsePath('structuredContent.summary')).toEqual([
      { kind: 'key', key: 'structuredContent' },
      { kind: 'key', key: 'summary' },
    ]);
  });

  it('parses bracket indices and wildcards', () => {
    expect(parsePath('content[0].text')).toEqual([
      { kind: 'key', key: 'content' },
      { kind: 'index', index: 0 },
      { kind: 'key', key: 'text' },
    ]);
    expect(parsePath('items[*].id')).toEqual([
      { kind: 'key', key: 'items' },
      { kind: 'wildcard' },
      { kind: 'key', key: 'id' },
    ]);
  });

  it('parses a leading bracket (root-level array)', () => {
    expect(parsePath('[*].name')).toEqual([{ kind: 'wildcard' }, { kind: 'key', key: 'name' }]);
    expect(parsePath('[2]')).toEqual([{ kind: 'index', index: 2 }]);
  });

  it('rejects whole-result paths with guidance', () => {
    expect(() => parsePath('')).toThrow(/whole result/);
    expect(() => parsePath('(root)')).toThrow(/whole result/);
  });

  it('rejects malformed paths with the offending detail', () => {
    expect(() => parsePath('a..b')).toThrow(/Invalid result path/);
    expect(() => parsePath('.a')).toThrow(/cannot start/);
    expect(() => parsePath('a.')).toThrow(/trailing/);
    expect(() => parsePath('a[')).toThrow(/unclosed/);
    expect(() => parsePath('a[x]')).toThrow(/array index or "\*"/);
    expect(() => parsePath('a[-1]')).toThrow(/array index or "\*"/);
    expect(() => parsePath('a[0]x')).toThrow(/expected "\." or "\["/);
    expect(() => parsePath('a.[0]')).toThrow(/Invalid result path/);
  });
});

describe('applyAtPath', () => {
  const upper = (v: unknown): unknown => (typeof v === 'string' ? v.toUpperCase() : v);

  it('applies at a nested key path, leaving siblings untouched', () => {
    const tree = { a: { b: 'hit', c: 'miss' }, d: 'miss' };
    expect(applyAtPath(tree, parsePath('a.b'), upper)).toEqual({
      a: { b: 'HIT', c: 'miss' },
      d: 'miss',
    });
  });

  it('applies at an exact array index only', () => {
    const tree = { items: ['zero', 'one', 'two'] };
    expect(applyAtPath(tree, parsePath('items[1]'), upper)).toEqual({
      items: ['zero', 'ONE', 'two'],
    });
  });

  it('wildcard applies to every array element', () => {
    const tree = {
      items: [
        { id: 'a', keep: 'x' },
        { id: 'b', keep: 'y' },
      ],
    };
    expect(applyAtPath(tree, parsePath('items[*].id'), upper)).toEqual({
      items: [
        { id: 'A', keep: 'x' },
        { id: 'B', keep: 'y' },
      ],
    });
  });

  it('can target a whole subtree, not just scalars', () => {
    const tree = { meta: { a: 1 }, keep: true };
    expect(applyAtPath(tree, parsePath('meta'), () => 'gone')).toEqual({
      meta: 'gone',
      keep: true,
    });
  });

  it('misses are identity no-ops: the input tree is returned unchanged', () => {
    const tree = { a: { b: 'x' }, list: [1, 2] };
    // Missing key, out-of-bounds index, and kind mismatches all no-op.
    expect(applyAtPath(tree, parsePath('a.nope'), upper)).toBe(tree);
    expect(applyAtPath(tree, parsePath('list[9]'), upper)).toBe(tree);
    expect(applyAtPath(tree, parsePath('a[*]'), upper)).toBe(tree); // wildcard on object
    expect(applyAtPath(tree, parsePath('list.b'), upper)).toBe(tree); // key on array
  });

  it('never mutates the input', () => {
    const tree = { items: [{ id: 'a' }] };
    const snapshot = JSON.parse(JSON.stringify(tree));
    applyAtPath(tree, parsePath('items[*].id'), upper);
    expect(tree).toEqual(snapshot);
  });
});

import { describe, expect, it } from 'vitest';
import type { GoldenConfig } from './config';
import { applyNormalizers, BUILTIN_NORMALIZER_NAMES } from './normalize';
import {
  buildPipeline,
  describePipeline,
  effectivePipelineSpec,
  IGNORED_PLACEHOLDER,
} from './pipeline';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('buildPipeline', () => {
  it('a path-scoped normalizer affects only its path, not siblings', () => {
    const pipeline = buildPipeline({
      normalizers: [],
      paths: { 'items[*].id': 'uuid' },
      sortArrays: [],
      ignore: [],
    });
    const result = pipeline({
      items: [{ id: UUID, label: UUID }],
      top: UUID,
    });
    expect(result).toEqual({
      items: [{ id: '<uuid>', label: UUID }],
      top: UUID,
    });
  });

  it('a scoped rule normalizes the whole subtree at its path', () => {
    const pipeline = buildPipeline({
      normalizers: [],
      paths: { meta: 'uuid' },
      sortArrays: [],
      ignore: [],
    });
    expect(pipeline({ meta: { a: UUID, nested: { b: UUID } }, keep: UUID })).toEqual({
      meta: { a: '<uuid>', nested: { b: '<uuid>' } },
      keep: UUID,
    });
  });

  it('accepts a list of refs at one path, applied in order', () => {
    const wrap = (tag: string) => ({
      name: tag,
      apply: (v: unknown) => (typeof v === 'string' ? `${v}|${tag}` : v),
    });
    const pipeline = buildPipeline({
      normalizers: [],
      paths: { a: [wrap('one'), wrap('two')] },
      sortArrays: [],
      ignore: [],
    });
    expect(pipeline({ a: 'x' })).toEqual({ a: 'x|one|two' });
  });

  it('ignore collapses the subtree to the placeholder', () => {
    const pipeline = buildPipeline({
      normalizers: [],
      paths: {},
      sortArrays: [],
      ignore: ['meta.elapsedMs'],
    });
    expect(pipeline({ meta: { elapsedMs: 12.5, keep: 1 }, ok: true })).toEqual({
      meta: { elapsedMs: IGNORED_PLACEHOLDER, keep: 1 },
      ok: true,
    });
  });

  it('ignore beats overlapping whole-tree and path-scoped normalizers', () => {
    const pipeline = buildPipeline({
      normalizers: ['uuid'],
      paths: { 'meta.id': 'hex-id' },
      sortArrays: [],
      ignore: ['meta.id'],
    });
    expect(pipeline({ meta: { id: UUID } })).toEqual({ meta: { id: IGNORED_PLACEHOLDER } });
  });

  it('applies whole-tree normalizers before scoped rules', () => {
    // The scoped custom fn sees the already-collapsed <uuid> placeholder.
    const seen: unknown[] = [];
    const spy = {
      name: 'spy',
      apply: (v: unknown) => {
        seen.push(v);
        return v;
      },
    };
    const pipeline = buildPipeline({
      normalizers: ['uuid'],
      paths: { a: spy },
      sortArrays: [],
      ignore: [],
    });
    pipeline({ a: UUID });
    expect(seen).toEqual(['<uuid>']);
  });

  it('an empty spec is equivalent to plain applyNormalizers', () => {
    const pipeline = buildPipeline({
      normalizers: ['iso-timestamp'],
      paths: {},
      sortArrays: [],
      ignore: [],
    });
    const value = { t: '2026-08-04T10:00:00Z', n: 5 };
    expect(pipeline(value)).toEqual(applyNormalizers(value, ['iso-timestamp']));
  });

  it('every builtin is idempotent (safe to re-apply to stored goldens)', () => {
    const volatile = {
      t: '2026-08-04T10:00:00.123Z',
      id: UUID,
      hex: 'deadbeefdeadbeef',
      p: '/var/tmp/thing/file.txt',
      ms: 1_722_772_800_000,
      s: 1_722_772_800,
    };
    const pipeline = buildPipeline({
      normalizers: [...BUILTIN_NORMALIZER_NAMES],
      paths: {},
      sortArrays: [],
      ignore: [],
    });
    const once = pipeline(volatile);
    expect(pipeline(once)).toEqual(once);
  });

  it('rejects a bad path up front', () => {
    expect(() =>
      buildPipeline({ normalizers: [], paths: { 'a..b': 'uuid' }, sortArrays: [], ignore: [] }),
    ).toThrow(/Invalid result path/);
    expect(() =>
      buildPipeline({ normalizers: [], paths: {}, sortArrays: [], ignore: [''] }),
    ).toThrow(/whole result/);
  });
});

describe('effectivePipelineSpec', () => {
  const cfg: GoldenConfig = {
    specVersion: '2025-11-25',
    defaultNormalizers: ['iso-timestamp'],
    defaultPaths: { 'content[*].text': 'uuid' },
    defaultSortArrays: ['items'],
    defaultIgnore: ['meta.elapsedMs'],
    tools: {
      plain: { cases: [{ case: 'a', arguments: {} }] },
      overriding: {
        cases: [{ case: 'a', arguments: {} }],
        normalizers: [],
        paths: {},
        sortArrays: [],
        ignore: ['other'],
      },
    },
  };

  it('falls back to defaults per key', () => {
    expect(effectivePipelineSpec(cfg, 'plain')).toEqual({
      normalizers: ['iso-timestamp'],
      paths: { 'content[*].text': 'uuid' },
      sortArrays: ['items'],
      ignore: ['meta.elapsedMs'],
    });
  });

  it('per-tool settings replace defaults independently', () => {
    expect(effectivePipelineSpec(cfg, 'overriding')).toEqual({
      normalizers: [],
      paths: {},
      sortArrays: [],
      ignore: ['other'],
    });
  });
});

describe('describePipeline', () => {
  it('names every stage in execution order', () => {
    const names = describePipeline({
      normalizers: ['iso-timestamp', { name: 'custom', apply: (v) => v }],
      paths: { 'items[*].id': ['uuid', 'hex-id'] },
      sortArrays: ['items'],
      ignore: ['meta.elapsedMs'],
    });
    expect(names).toEqual([
      'iso-timestamp',
      'custom',
      'uuid @ items[*].id',
      'hex-id @ items[*].id',
      'sort-arrays @ items',
      'ignore @ meta.elapsedMs',
    ]);
  });
});

describe('sortArrays stage', () => {
  const spec = (sortArrays: string[]) => ({ normalizers: [], paths: {}, sortArrays, ignore: [] });

  it('sorts only the array at its path, not sibling arrays', () => {
    const pipeline = buildPipeline(spec(['unordered']));
    expect(pipeline({ unordered: [3, 1, 2], ordered: [3, 1, 2] })).toEqual({
      unordered: [1, 2, 3],
      ordered: [3, 1, 2],
    });
  });

  it('sorts objects deterministically regardless of input order', () => {
    const pipeline = buildPipeline(spec(['items']));
    const a = pipeline({
      items: [
        { sku: 'b', qty: 2 },
        { sku: 'a', qty: 9 },
      ],
    });
    const b = pipeline({
      items: [
        { sku: 'a', qty: 9 },
        { sku: 'b', qty: 2 },
      ],
    });
    expect(a).toEqual(b);
    // Objects compare by their alphabetically-first key's value first: qty 2 < 9.
    expect(a).toEqual({
      items: [
        { sku: 'b', qty: 2 },
        { sku: 'a', qty: 9 },
      ],
    });
  });

  it('value-normalizes before sorting: two orderings of volatile elements converge', () => {
    // Each element has a volatile uuid; only after collapsing them can the
    // orderings converge — which is exactly why sort runs after normalization.
    const uuidA = '11111111-1111-4111-8111-111111111111';
    const uuidB = '22222222-2222-4222-8222-222222222222';
    const pipeline = buildPipeline({
      normalizers: [],
      paths: { 'items[*].id': 'uuid' },
      sortArrays: ['items'],
      ignore: [],
    });
    const one = pipeline({
      items: [
        { id: uuidA, sku: 'x' },
        { id: uuidB, sku: 'y' },
      ],
    });
    const two = pipeline({
      items: [
        { id: uuidB, sku: 'y' },
        { id: uuidA, sku: 'x' },
      ],
    });
    expect(one).toEqual(two);
  });

  it('ignore wins over sort on an overlapping path', () => {
    const pipeline = buildPipeline({
      normalizers: [],
      paths: {},
      sortArrays: ['items'],
      ignore: ['items'],
    });
    expect(pipeline({ items: [3, 1, 2] })).toEqual({ items: '<ignored>' });
  });

  it('a wildcard path sorts each nested array independently', () => {
    const pipeline = buildPipeline(spec(['rows[*].tags']));
    expect(pipeline({ rows: [{ tags: ['b', 'a'] }, { tags: ['z', 'y'] }] })).toEqual({
      rows: [{ tags: ['a', 'b'] }, { tags: ['y', 'z'] }],
    });
  });

  it('no-ops on a non-array value at the path', () => {
    const pipeline = buildPipeline(spec(['notAnArray']));
    const tree = { notAnArray: { a: 1 } };
    expect(pipeline(tree)).toEqual(tree);
  });

  it('nested sort paths give the same result in either declaration order', () => {
    const value = {
      matrix: [
        [2, 1],
        [1, 2],
        [0, 9],
      ],
    };
    const innerFirst = buildPipeline(spec(['matrix[*]', 'matrix']))(value);
    const outerFirst = buildPipeline(spec(['matrix', 'matrix[*]']))(value);
    expect(innerFirst).toEqual(outerFirst);
    expect(innerFirst).toEqual({
      matrix: [
        [0, 9],
        [1, 2],
        [1, 2],
      ],
    });
  });

  it('is idempotent, satisfying the both-sides contract', () => {
    const pipeline = buildPipeline({
      normalizers: ['uuid'],
      paths: {},
      sortArrays: ['items'],
      ignore: ['meta'],
    });
    const value = { items: [{ v: 2 }, { v: 1 }], meta: { t: 1 } };
    const once = pipeline(value);
    expect(pipeline(once)).toEqual(once);
  });

  it('rejects a bad sort path up front', () => {
    expect(() => buildPipeline(spec(['items[']))).toThrow(/unclosed/);
  });
});

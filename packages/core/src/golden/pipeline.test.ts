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
    const pipeline = buildPipeline({ normalizers: [], paths: { meta: 'uuid' }, ignore: [] });
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
      ignore: [],
    });
    expect(pipeline({ a: 'x' })).toEqual({ a: 'x|one|two' });
  });

  it('ignore collapses the subtree to the placeholder', () => {
    const pipeline = buildPipeline({ normalizers: [], paths: {}, ignore: ['meta.elapsedMs'] });
    expect(pipeline({ meta: { elapsedMs: 12.5, keep: 1 }, ok: true })).toEqual({
      meta: { elapsedMs: IGNORED_PLACEHOLDER, keep: 1 },
      ok: true,
    });
  });

  it('ignore beats overlapping whole-tree and path-scoped normalizers', () => {
    const pipeline = buildPipeline({
      normalizers: ['uuid'],
      paths: { 'meta.id': 'hex-id' },
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
    const pipeline = buildPipeline({ normalizers: ['uuid'], paths: { a: spy }, ignore: [] });
    pipeline({ a: UUID });
    expect(seen).toEqual(['<uuid>']);
  });

  it('an empty spec is equivalent to plain applyNormalizers', () => {
    const pipeline = buildPipeline({ normalizers: ['iso-timestamp'], paths: {}, ignore: [] });
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
      ignore: [],
    });
    const once = pipeline(volatile);
    expect(pipeline(once)).toEqual(once);
  });

  it('rejects a bad path up front', () => {
    expect(() => buildPipeline({ normalizers: [], paths: { 'a..b': 'uuid' }, ignore: [] })).toThrow(
      /Invalid result path/,
    );
    expect(() => buildPipeline({ normalizers: [], paths: {}, ignore: [''] })).toThrow(
      /whole result/,
    );
  });
});

describe('effectivePipelineSpec', () => {
  const cfg: GoldenConfig = {
    specVersion: '2025-11-25',
    defaultNormalizers: ['iso-timestamp'],
    defaultPaths: { 'content[*].text': 'uuid' },
    defaultIgnore: ['meta.elapsedMs'],
    tools: {
      plain: { cases: [{ case: 'a', arguments: {} }] },
      overriding: {
        cases: [{ case: 'a', arguments: {} }],
        normalizers: [],
        paths: {},
        ignore: ['other'],
      },
    },
  };

  it('falls back to defaults per key', () => {
    expect(effectivePipelineSpec(cfg, 'plain')).toEqual({
      normalizers: ['iso-timestamp'],
      paths: { 'content[*].text': 'uuid' },
      ignore: ['meta.elapsedMs'],
    });
  });

  it('per-tool settings replace defaults independently', () => {
    expect(effectivePipelineSpec(cfg, 'overriding')).toEqual({
      normalizers: [],
      paths: {},
      ignore: ['other'],
    });
  });
});

describe('describePipeline', () => {
  it('names every stage, scoped rules and ignores included', () => {
    const names = describePipeline({
      normalizers: ['iso-timestamp', { name: 'custom', apply: (v) => v }],
      paths: { 'items[*].id': ['uuid', 'hex-id'] },
      ignore: ['meta.elapsedMs'],
    });
    expect(names).toEqual([
      'iso-timestamp',
      'custom',
      'uuid @ items[*].id',
      'hex-id @ items[*].id',
      'ignore @ meta.elapsedMs',
    ]);
  });
});

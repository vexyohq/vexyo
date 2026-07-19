import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import { jsonEqual, stableStringify } from './serialize';

describe('stableStringify', () => {
  it('sorts object keys so key order does not affect output', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('is idempotent and ends with a trailing newline', () => {
    const out = stableStringify({ x: [3, 1, 2], y: { d: 1, c: 2 } });
    expect(out.endsWith('\n')).toBe(true);
    expect(stableStringify(JSON.parse(out))).toBe(out);
  });

  it('preserves array order (order can be semantically meaningful)', () => {
    expect(JSON.parse(stableStringify([3, 1, 2]))).toEqual([3, 1, 2]);
  });
});

describe('jsonEqual', () => {
  it('ignores key order but not values', () => {
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

// Users commit goldens into repos that run Prettier; our serializer output must
// be a Prettier fixed point so it is never reformatted on the next commit.
describe('stableStringify is Prettier-stable', () => {
  // JSON files use printWidth 100 (.prettierrc) and Prettier's default tabWidth 2
  // and objectWrap "preserve".
  const opts = { parser: 'json' as const, printWidth: 100, tabWidth: 2 };

  async function expectPrettierStable(value: unknown): Promise<void> {
    const serialized = stableStringify(value);
    const reformatted = await format(serialized, opts);
    expect(reformatted).toBe(serialized);
  }

  it('golden-like structures are unchanged by prettier', async () => {
    await expectPrettierStable({
      formatVersion: 1,
      resources: [{ uri: 'vexyo://readme', name: 'readme' }],
      tools: [
        {
          name: 'add',
          title: 'Add',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'number' }, b: { type: 'number' } },
            required: ['a', 'b'],
          },
        },
        { name: 'stamp', title: 'Stamp', inputSchema: { type: 'object', properties: {} } },
      ],
    });
  });

  it('collapses short arrays, breaks long ones, fills number lists', async () => {
    await expectPrettierStable({
      short: ['a', 'b'],
      longStrings: Array.from({ length: 40 }, (_, i) => `item-number-${i}`),
      numbers: Array.from({ length: 60 }, (_, i) => i),
      objects: [{ x: 1 }, { y: 2 }],
    });
  });

  it('handles nesting, empties, and arrays of arrays', async () => {
    await expectPrettierStable({
      nested: { a: { b: { c: [] } } },
      emptyObject: {},
      arrayOfEmpty: [{}],
      matrix: [
        [1, 2],
        [3, 4],
      ],
    });
  });

  it('handles a value whose flat form sits right at the width boundary', async () => {
    // Tune a string so the flattened line lands near printWidth.
    for (let n = 70; n <= 110; n += 1) {
      await expectPrettierStable({ key: { value: 'x'.repeat(n) }, list: ['a', 'b', 'c'] });
    }
  });
});

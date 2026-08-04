import { describe, expect, it } from 'vitest';
import { jsonEqual } from './serialize';
import { compareJsonValues } from './sort';

const sorted = (values: unknown[]): unknown[] => [...values].sort(compareJsonValues);

describe('compareJsonValues', () => {
  it('orders by type rank: null < boolean < number < string < array < object', () => {
    expect(sorted([{ a: 1 }, [1], 'x', 2, true, null])).toEqual([
      null,
      true,
      2,
      'x',
      [1],
      { a: 1 },
    ]);
  });

  it('orders numbers numerically, not textually', () => {
    expect(sorted([10, 2, 1])).toEqual([1, 2, 10]);
    expect(compareJsonValues(-0, 0)).toBe(0); // JSON prints both as "0"
  });

  it('orders booleans false < true', () => {
    expect(sorted([true, false])).toEqual([false, true]);
  });

  it('orders strings by UTF-16 code units (no locale)', () => {
    expect(sorted(['a', 'Z'])).toEqual(['Z', 'a']);
    expect(sorted(['b', 'ä'])).toEqual(['b', 'ä']);
  });

  it('orders arrays element-wise, then by length', () => {
    expect(compareJsonValues([1, 2], [1, 3])).toBeLessThan(0);
    expect(compareJsonValues([1], [1, 0])).toBeLessThan(0);
    expect(compareJsonValues([2], [1, 9])).toBeGreaterThan(0);
  });

  it('orders objects by sorted key sequence, then values in key order', () => {
    expect(compareJsonValues({ a: 1 }, { b: 0 })).toBeLessThan(0); // key 'a' < key 'b'
    expect(compareJsonValues({ a: 1 }, { a: 2 })).toBeLessThan(0);
    expect(compareJsonValues({ a: 1 }, { a: 1, b: 1 })).toBeLessThan(0); // prefix keys, shorter first
  });

  it('projects non-JSON values the way serialization does', () => {
    expect(compareJsonValues(Number.NaN, null)).toBe(0);
    expect(compareJsonValues(Number.POSITIVE_INFINITY, null)).toBe(0);
    expect(compareJsonValues(undefined, null)).toBe(0);
    // NaN must not tie with real numbers (that would make the order intransitive).
    expect(compareJsonValues(Number.NaN, 5)).toBeLessThan(0); // null-rank < number-rank
    expect(compareJsonValues({ a: undefined }, {})).toBe(0);
    expect(compareJsonValues({ a: undefined, b: 1 }, { b: 1 })).toBe(0);
  });

  it('ties exactly where jsonEqual says equal (the load-bearing contract)', () => {
    const pairs: Array<[unknown, unknown]> = [
      [-0, 0],
      [Number.NaN, null],
      [{ a: undefined }, {}],
      [
        { b: 2, a: 1 },
        { a: 1, b: 2 },
      ],
      [
        [1, [2, 3]],
        [1, [2, 3]],
      ],
      [{ a: [1, 2] }, { a: [1, 2] }],
      ['x', 'x'],
      // …and pairs that must NOT tie:
      [{ a: 1 }, { a: 2 }],
      [
        [1, 2],
        [2, 1],
      ],
      ['10', 10],
      [null, false],
      [{}, []],
      [{ a: null }, {}],
    ];
    for (const [a, b] of pairs) {
      expect(compareJsonValues(a, b) === 0, JSON.stringify([a, b])).toBe(jsonEqual(a, b));
      // Antisymmetry while we're here (signs must cancel; avoids the -0 Object.is trap).
      expect(Math.sign(compareJsonValues(a, b)) + Math.sign(compareJsonValues(b, a))).toBe(0);
    }
  });

  it('sorts every shuffle of a mixed array to the same result', () => {
    const base = [
      { sku: 'b', qty: 2 },
      { sku: 'a', qty: 9 },
      null,
      [3, 1],
      'text',
      7,
      { sku: 'a', qty: 1 },
    ];
    const reference = sorted(base);
    for (let round = 0; round < 25; round += 1) {
      const pool = [...base];
      const shuffled: unknown[] = [];
      while (pool.length > 0) {
        shuffled.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
      }
      expect(jsonEqual(sorted(shuffled), reference)).toBe(true);
    }
  });

  it('is stable: tied elements keep input order (by identity)', () => {
    const x = { v: 1 };
    const y = { v: 1 };
    const result = [x, y].slice().sort(compareJsonValues);
    expect(result[0]).toBe(x);
    expect(result[1]).toBe(y);
  });
});

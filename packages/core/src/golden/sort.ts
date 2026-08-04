/**
 * A deterministic total order over JSON values, used by the `sortArrays`
 * pipeline stage. The contract that makes sorted goldens stable is:
 *
 *   compareJsonValues(a, b) === 0  ⟺  jsonEqual(a, b)
 *
 * (i.e. ties are exactly serialize.ts's canonical equality). Under a stable
 * sort, tied blocks then contain only mutually-equal elements, so any two
 * permutations of equal multisets sort position-wise equal — which is what
 * guarantees determinism across runs, idempotency (ADR-0008 both-sides
 * contract), and no false drift.
 *
 * To keep that equivalence for everything the pipeline can produce (custom
 * normalizers may inject non-JSON values), values are projected the way JSON
 * serialization would see them before ranking: non-finite numbers, `undefined`
 * and functions become null, and object keys holding `undefined`/functions are
 * skipped. Nothing locale-dependent: strings compare by UTF-16 code units.
 */

type Rank = 0 | 1 | 2 | 3 | 4 | 5;

/** null(0) < boolean(1) < number(2) < string(3) < array(4) < object(5). */
function rank(value: unknown): Rank {
  if (Array.isArray(value)) {
    return 4;
  }
  switch (typeof value) {
    case 'boolean':
      return 1;
    case 'number':
      return 2;
    case 'string':
      return 3;
    case 'object':
      return value === null ? 0 : 5;
    default:
      // undefined, function, symbol, bigint — serialized as null.
      return 0;
  }
}

/** Mirror of JSON serialization for scalars: anything unrepresentable → null. */
function project(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }
  const r = rank(value);
  return r === 0 ? null : value;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Object keys that survive JSON serialization, in code-unit order. */
function serializableKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .filter((key) => {
      const child = record[key];
      return child !== undefined && typeof child !== 'function';
    })
    .sort();
}

/**
 * Total, deterministic comparison of two JSON values: by type rank, then
 * within-type (numbers numerically, strings by code unit, arrays element-wise
 * then by length, objects by sorted key sequence then values in key order).
 */
export function compareJsonValues(a: unknown, b: unknown): number {
  const pa = project(a);
  const pb = project(b);

  const ra = rank(pa);
  const rb = rank(pb);
  if (ra !== rb) {
    return ra - rb;
  }

  switch (ra) {
    case 0:
      return 0; // both null
    case 1:
      return Number(pa) - Number(pb); // false < true
    case 2: {
      const na = pa as number;
      const nb = pb as number;
      return na < nb ? -1 : na > nb ? 1 : 0; // -0 ties 0, as JSON prints both "0"
    }
    case 3:
      return compareStrings(pa as string, pb as string);
    case 4: {
      const aa = pa as unknown[];
      const ab = pb as unknown[];
      const len = Math.min(aa.length, ab.length);
      for (let i = 0; i < len; i += 1) {
        const cmp = compareJsonValues(aa[i], ab[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return aa.length - ab.length;
    }
    default: {
      const oa = pa as Record<string, unknown>;
      const ob = pb as Record<string, unknown>;
      const ka = serializableKeys(oa);
      const kb = serializableKeys(ob);
      const len = Math.min(ka.length, kb.length);
      for (let i = 0; i < len; i += 1) {
        const keyCmp = compareStrings(ka[i] as string, kb[i] as string);
        if (keyCmp !== 0) {
          return keyCmp;
        }
      }
      if (ka.length !== kb.length) {
        return ka.length - kb.length;
      }
      for (const key of ka) {
        const cmp = compareJsonValues(oa[key], ob[key]);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return 0;
    }
  }
}

/**
 * The single choke-point for golden-file determinism. Every golden is written
 * through {@link stableStringify}, which recursively sorts object keys and emits
 * JSON that is a **fixed point of Prettier** (2-space indent, trailing newline):
 * running `prettier --check` on a freshly written golden makes no changes. This
 * matters because users commit goldens into repos that run Prettier — our output
 * must survive that byte-identically, not get reformatted on the next commit.
 *
 * The rule mirrors Prettier's JSON printer (with the default `objectWrap:
 * "preserve"`): a container is printed on one line if that flat form fits within
 * the print width at its column, otherwise it breaks one entry per line. Objects
 * use `{ ... }` (inner spaces); arrays use `[...]`; a broken array of only
 * numbers is packed ("fill") the way Prettier packs number lists.
 */

// Must match `.prettierrc.json` printWidth. Changing either requires re-recording goldens.
const PRINT_WIDTH = 100;
const INDENT = '  ';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Drop `undefined`/function values (as JSON would) and sort object keys. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item === undefined ? null : item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child !== undefined && typeof child !== 'function') {
        out[key] = canonicalize(child);
      }
    }
    return out;
  }
  return typeof value === 'function' ? null : value;
}

/** Single-line rendering of a canonical value (used to measure fit). */
function flat(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.map(flat).join(', ')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${flat(value[k])}`).join(', ')} }`;
  }
  return JSON.stringify(value);
}

/**
 * Print a canonical value starting at `column`, breaking to `level` indentation
 * when the flat form (plus a trailing comma, if this value is followed by a
 * sibling) would exceed the print width.
 */
function print(value: unknown, level: number, column: number, trailer: number): string {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return JSON.stringify(value);
  }

  const flatForm = flat(value);
  const mustBreak = Array.isArray(value) && forcesBreak(value);
  if (!mustBreak && column + flatForm.length + trailer <= PRINT_WIDTH) {
    return flatForm;
  }

  const childIndent = INDENT.repeat(level + 1);
  const closeIndent = INDENT.repeat(level);

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'number')) {
      return fillNumbers(value, level);
    }
    const items = value.map((item, i) =>
      print(item, level + 1, childIndent.length, i < value.length - 1 ? 1 : 0),
    );
    return `[\n${items.map((s) => childIndent + s).join(',\n')}\n${closeIndent}]`;
  }

  const keys = Object.keys(value);
  const props = keys.map((key, i) => {
    const prefix = `${JSON.stringify(key)}: `;
    const rendered = print(
      value[key],
      level + 1,
      childIndent.length + prefix.length,
      i < keys.length - 1 ? 1 : 0,
    );
    return `${childIndent}${prefix}${rendered}`;
  });
  return `{\n${props.join(',\n')}\n${closeIndent}}`;
}

/**
 * Prettier's "table" heuristic: an array is always broken onto multiple lines
 * (regardless of width) when it has more than one element and every element is
 * an array or object with more than one child.
 */
function forcesBreak(value: readonly unknown[]): boolean {
  return (
    value.length > 1 &&
    value.every(
      (el) =>
        (Array.isArray(el) && el.length > 1) || (isPlainObject(el) && Object.keys(el).length > 1),
    )
  );
}

/** Pack a broken number array, wrapping before the width is exceeded (Prettier "fill"). */
function fillNumbers(value: readonly number[], level: number): string {
  const childIndent = INDENT.repeat(level + 1);
  const lines: string[] = [];
  let current = '';
  value.forEach((num, i) => {
    const token = i < value.length - 1 ? `${JSON.stringify(num)},` : JSON.stringify(num);
    if (current === '') {
      current = token;
    } else if (childIndent.length + current.length + 1 + token.length <= PRINT_WIDTH) {
      current = `${current} ${token}`;
    } else {
      lines.push(current);
      current = token;
    }
  });
  if (current !== '') {
    lines.push(current);
  }
  return `[\n${lines.map((l) => childIndent + l).join('\n')}\n${INDENT.repeat(level)}]`;
}

/** Deterministic, Prettier-stable JSON: sorted keys, 2-space indent, trailing newline. */
export function stableStringify(value: unknown): string {
  return `${print(canonicalize(value), 0, 0, 0)}\n`;
}

/** Deep JSON equality via canonical serialization. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

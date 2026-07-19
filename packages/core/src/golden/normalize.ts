/**
 * Normalizers collapse volatile values (timestamps, ids, paths) to stable
 * placeholders so a re-recorded golden matches. Both `record` and the
 * regression comparison run the *same* pipeline, so a normalized field can
 * never register as drift.
 */

export type NormalizerFn = (value: unknown) => unknown;

/** A normalizer is either a builtin name or an inline `{ name, apply }` object. */
export interface NormalizerObject {
  name: string;
  apply: NormalizerFn;
}
export type NormalizerRef = string | NormalizerObject;

interface StringPattern {
  readonly regex: RegExp;
  readonly placeholder: string;
}

/** Builtins that replace matching substrings inside every string value. */
const STRING_PATTERNS: Record<string, StringPattern> = {
  'iso-timestamp': {
    regex: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g,
    placeholder: '<timestamp>',
  },
  uuid: {
    regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    placeholder: '<uuid>',
  },
  'hex-id': { regex: /\b[0-9a-fA-F]{16,}\b/g, placeholder: '<hex>' },
  'abs-path': { regex: /(?:\/[\w.-]+){2,}\/?/g, placeholder: '<path>' },
};

/** Builtins that replace integer values in a plausible epoch range. */
const NUMBER_RANGES: Record<string, { min: number; max: number }> = {
  'epoch-millis': { min: 1_000_000_000_000, max: 2_000_000_000_000 },
  'epoch-seconds': { min: 1_000_000_000, max: 2_000_000_000 },
};

export const BUILTIN_NORMALIZER_NAMES: readonly string[] = [
  ...Object.keys(STRING_PATTERNS),
  ...Object.keys(NUMBER_RANGES),
];

function builtin(name: string): NormalizerFn {
  const stringPattern = STRING_PATTERNS[name];
  if (stringPattern) {
    return (value) =>
      mapScalars(value, (scalar) =>
        typeof scalar === 'string'
          ? scalar.replace(stringPattern.regex, stringPattern.placeholder)
          : scalar,
      );
  }
  const range = NUMBER_RANGES[name];
  if (range) {
    return (value) =>
      mapScalars(value, (scalar) =>
        typeof scalar === 'number' &&
        Number.isInteger(scalar) &&
        scalar >= range.min &&
        scalar < range.max
          ? '<epoch>'
          : scalar,
      );
  }
  throw new Error(
    `Unknown normalizer "${name}". Available builtins: ${BUILTIN_NORMALIZER_NAMES.join(', ')}.`,
  );
}

/** Deep-map every scalar (non-object, non-array) value in a JSON tree. */
function mapScalars(value: unknown, fn: (scalar: unknown) => unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapScalars(item, fn));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      out[key] = mapScalars(record[key], fn);
    }
    return out;
  }
  return fn(value);
}

function resolve(ref: NormalizerRef): NormalizerFn {
  return typeof ref === 'string' ? builtin(ref) : ref.apply;
}

export function normalizerName(ref: NormalizerRef): string {
  return typeof ref === 'string' ? ref : ref.name;
}

/** Apply a normalizer pipeline (in order) to a value. */
export function applyNormalizers(value: unknown, refs: readonly NormalizerRef[]): unknown {
  return refs.reduce<unknown>((acc, ref) => resolve(ref)(acc), value);
}

/**
 * Given a changed field's before/after, return builtin normalizer names that
 * would collapse it — i.e. whose pattern matches BOTH sides. This is what turns
 * a noisy diff into "add this normalizer" guidance instead of blind re-record
 * (CLAUDE.md hard rule #6).
 */
export function suggestNormalizer(before: unknown, after: unknown): string[] {
  const suggestions: string[] = [];
  for (const [name, pattern] of Object.entries(STRING_PATTERNS)) {
    if (
      typeof before === 'string' &&
      typeof after === 'string' &&
      matchesPattern(before, pattern.regex) &&
      matchesPattern(after, pattern.regex)
    ) {
      suggestions.push(name);
    }
  }
  for (const [name, range] of Object.entries(NUMBER_RANGES)) {
    if (inRange(before, range) && inRange(after, range)) {
      suggestions.push(name);
    }
  }
  return suggestions;
}

function matchesPattern(value: string, regex: RegExp): boolean {
  // Fresh lastIndex — the shared regexes are global.
  return new RegExp(regex.source).test(value);
}

function inRange(value: unknown, range: { min: number; max: number }): boolean {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= range.min && value < range.max
  );
}

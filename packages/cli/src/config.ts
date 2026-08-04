import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { parsePath } from '@vexyo/core';
import { z } from 'zod';

export const SPEC_VERSIONS = ['2025-11-25', '2026-07-28'] as const;

/** The spec version a run targets when the config doesn't override it. */
export const DEFAULT_SPEC_VERSION = SPEC_VERSIONS[0];

/** Config filenames auto-discovered in cwd, in resolution order. */
export const CONFIG_CANDIDATES = [
  'vexyo.config.ts',
  'vexyo.config.mts',
  'vexyo.config.js',
  'vexyo.config.mjs',
] as const;

const stdioTargetSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const httpTargetSchema = z.object({
  transport: z.literal('http'),
  url: z.string().min(1),
  /** Extra HTTP headers sent on every request (e.g. auth). */
  headers: z.record(z.string(), z.string()).optional(),
});

const targetSchema = z.discriminatedUnion('transport', [stdioTargetSchema, httpTargetSchema]);

/** A normalizer is a builtin name or an inline `{ name, apply }` object. */
const normalizerRefSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    apply: z.custom<(value: unknown) => unknown>((v) => typeof v === 'function'),
  }),
]);

const recordCaseSchema = z.object({
  case: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

/** Returns the parse error for a result path, or null if it is valid. */
function pathSyntaxError(path: string): string | null {
  try {
    parsePath(path);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Path-scoped normalizers: `{ 'items[*].id': 'uuid' }` (value may be a list). */
const pathNormalizersSchema = z
  .record(z.string(), z.union([normalizerRefSchema, z.array(normalizerRefSchema)]))
  .superRefine((record, ctx) => {
    for (const key of Object.keys(record)) {
      const message = pathSyntaxError(key);
      if (message !== null) {
        ctx.addIssue({ code: 'custom', path: [key], message });
      }
    }
  });

/** A single validated result path (`meta.elapsedMs`, `items[*].id`). */
const resultPathSchema = z.string().superRefine((value, ctx) => {
  const message = pathSyntaxError(value);
  if (message !== null) {
    ctx.addIssue({ code: 'custom', message });
  }
});

const recordToolSchema = z.object({
  cases: z.array(recordCaseSchema).min(1),
  normalizers: z.array(normalizerRefSchema).optional(),
  /** Path-scoped normalizers for this tool; overrides the defaults. */
  paths: pathNormalizersSchema.optional(),
  /** Paths whose array order is not significant; overrides the defaults. */
  sortArrays: z.array(resultPathSchema).optional(),
  /** Paths excluded from comparison for this tool; overrides the defaults. */
  ignore: z.array(resultPathSchema).optional(),
});

const regressionSchema = z.object({
  /** Committed golden directory (relative to the config file's cwd). */
  goldenDir: z.string().default('vexyo/goldens'),
  /** Severity at/above which drift fails the run. */
  failOn: z.enum(['error', 'warning']).default('error'),
  /** Default normalizers applied to every recorded tool. */
  normalizers: z.array(normalizerRefSchema).default([]),
  /** Default path-scoped normalizers applied to every recorded tool. */
  paths: pathNormalizersSchema.default({}),
  /** Default paths whose array order is not significant (sorted before diffing). */
  sortArrays: z.array(resultPathSchema).default([]),
  /** Default ignored paths applied to every recorded tool. */
  ignore: z.array(resultPathSchema).default([]),
  /** Tools to record/compare, keyed by name. Empty = record nothing (opt-in). */
  record: z.record(z.string(), recordToolSchema).default({}),
});

export const configSchema = z.object({
  specVersion: z.enum(SPEC_VERSIONS).default('2025-11-25'),
  target: targetSchema,
  security: z.boolean().default(false),
  regression: regressionSchema.optional(),
});

export type RegressionConfig = z.infer<typeof regressionSchema>;

/** Validated, defaults-applied config. */
export type Config = z.infer<typeof configSchema>;
/** Shape a user writes in a config file (before defaults are applied). */
export type UserConfig = z.input<typeof configSchema>;
export type StdioTarget = Extract<Config['target'], { transport: 'stdio' }>;

/** Raised for anything the user must fix in their config or invocation (exit 2). */
export class ConfigError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'ConfigError';
  }
}

/**
 * Resolve which config file to load: an explicit `--config` (relative to cwd),
 * otherwise the first {@link CONFIG_CANDIDATES} present in cwd. Throws a
 * {@link ConfigError} suggesting `vexyo init` when nothing is found. Returns an
 * absolute path.
 */
export function resolveConfigPath(
  explicit: string | undefined,
  cwd: string = process.cwd(),
): string {
  if (explicit) {
    return resolve(cwd, explicit);
  }
  for (const name of CONFIG_CANDIDATES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new ConfigError(
    `No config file found in ${cwd}. Create one with \`vexyo init\`, or pass --config <path>.`,
  );
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/**
 * Map vexyo's own package specifiers to the running CLI's installation so a
 * config that imports `@vexyo/cli/config` (defineConfig) loads even when it
 * lives in a directory without a local `node_modules` (a bare project, `/tmp`,
 * etc.). Resolved relative to THIS module — the CLI — not the config's location,
 * which is the pattern vite/eslint use for their own defineConfig imports. A
 * local install, when present, still wins (jiti prefers it over the alias).
 */
function selfPackageAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  let req: ReturnType<typeof createRequire>;
  try {
    // Empty `import.meta.url` (e.g. the Action's esbuild CJS bundle) → no alias;
    // there the CLI always runs where `@vexyo/cli` is already resolvable.
    req = createRequire(import.meta.url);
  } catch {
    return aliases;
  }
  for (const spec of ['@vexyo/cli/config', '@vexyo/cli', '@vexyo/core', '@vexyo/reporters']) {
    try {
      aliases[spec] = req.resolve(spec);
    } catch {
      // Unresolvable from here (e.g. dev without a built dist); jiti then
      // resolves the specifier from the config's own location instead.
    }
  }
  return aliases;
}

/**
 * Load and validate a config file. Supports `.ts`/`.js`/`.mjs` via jiti so the
 * blueprint's `examples/*.config.ts` work without a build step. The default
 * export is validated against {@link configSchema}.
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const absolute = resolve(process.cwd(), configPath);

  let mod: unknown;
  try {
    const jiti = createJiti(pathToFileURL(absolute).href, { alias: selfPackageAliases() });
    mod = await jiti.import(absolute, { default: true });
  } catch (err) {
    throw new ConfigError(
      `Could not load config file at ${absolute}. Check the path and that the file has a default export.`,
      err,
    );
  }

  const parsed = configSchema.safeParse(mod);
  if (!parsed.success) {
    throw new ConfigError(`Invalid config at ${absolute}:\n${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

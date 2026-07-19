import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { z } from 'zod';

export const SPEC_VERSIONS = ['2025-11-25', '2026-07-28'] as const;

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

const recordToolSchema = z.object({
  cases: z.array(recordCaseSchema).min(1),
  normalizers: z.array(normalizerRefSchema).optional(),
});

const regressionSchema = z.object({
  /** Committed golden directory (relative to the config file's cwd). */
  goldenDir: z.string().default('vexyo/goldens'),
  /** Severity at/above which drift fails the run. */
  failOn: z.enum(['error', 'warning']).default('error'),
  /** Default normalizers applied to every recorded tool. */
  normalizers: z.array(normalizerRefSchema).default([]),
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

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
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
    const jiti = createJiti(pathToFileURL(absolute).href);
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

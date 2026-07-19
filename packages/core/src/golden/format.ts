import { z } from 'zod';

/**
 * Golden-file format contract. This becomes public the moment a user commits a
 * golden, so it is versioned: bump {@link GOLDEN_FORMAT_VERSION} to evolve the
 * shape, and readers reject a mismatched version with a clear error rather than
 * silently misinterpreting old goldens.
 */
export const GOLDEN_FORMAT_VERSION = 1;

/** An opaque JSON object (a tool/resource/prompt definition, or a tool result). */
const jsonRecord = z.record(z.string(), z.unknown());

export const GoldenManifestSchema = z.object({
  formatVersion: z.literal(GOLDEN_FORMAT_VERSION),
  specVersion: z.string(),
  server: z.object({ name: z.string(), version: z.string() }),
  tools: z.array(jsonRecord),
  resources: z.array(jsonRecord),
  prompts: z.array(jsonRecord),
});
export type GoldenManifest = z.infer<typeof GoldenManifestSchema>;

export const GoldenCaseSchema = z.object({
  case: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  /** Names of the normalizers applied at record time (for human reference). */
  normalizers: z.array(z.string()),
  result: z.unknown(),
});
export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

export const GoldenRecordingSchema = z.object({
  formatVersion: z.literal(GOLDEN_FORMAT_VERSION),
  tool: z.string(),
  cases: z.array(GoldenCaseSchema),
});
export type GoldenRecording = z.infer<typeof GoldenRecordingSchema>;

/** The full committed golden set: one manifest + one recording file per tool. */
export interface GoldenSet {
  manifest: GoldenManifest;
  recordings: GoldenRecording[];
}

// --- Regression finding detail (rides the existing `Finding.detail`) ---

export const FieldDiffSchema = z.object({
  path: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type FieldDiff = z.infer<typeof FieldDiffSchema>;

export type RegressionKind = 'schema' | 'behavioral' | 'coverage';

export const RegressionDetailSchema = z.object({
  kind: z.enum(['schema', 'behavioral', 'coverage']),
  target: z.object({
    type: z.enum(['tool', 'resource', 'prompt']),
    name: z.string(),
    case: z.string().optional(),
  }),
  change: z.enum(['added', 'removed', 'changed']),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  fieldDiffs: z.array(FieldDiffSchema).optional(),
  /** Builtin normalizer names that would collapse a volatile-looking diff. */
  suggestedNormalizers: z.array(z.string()).optional(),
});
export type RegressionDetail = z.infer<typeof RegressionDetailSchema>;

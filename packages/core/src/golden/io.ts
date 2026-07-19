import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { isRecord } from '../mcp/schemas';
import {
  GOLDEN_FORMAT_VERSION,
  GoldenManifestSchema,
  GoldenRecordingSchema,
  type GoldenRecording,
  type GoldenSet,
} from './format';
import { stableStringify } from './serialize';

/** Raised for missing/malformed/version-mismatched golden files (exit 2). */
export class GoldenError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'GoldenError';
  }
}

/** Write the golden set as `manifest.json` + `recordings/<tool>.json`, deterministically. */
export async function writeGoldenSet(dir: string, set: GoldenSet): Promise<string[]> {
  await mkdir(join(dir, 'recordings'), { recursive: true });
  const written: string[] = [];

  const manifestPath = join(dir, 'manifest.json');
  await writeFile(manifestPath, stableStringify(set.manifest));
  written.push(manifestPath);

  for (const recording of [...set.recordings].sort((a, b) => (a.tool < b.tool ? -1 : 1))) {
    const path = join(dir, 'recordings', `${recording.tool}.json`);
    await writeFile(path, stableStringify(recording));
    written.push(path);
  }
  return written;
}

/** Read and validate a golden set. Throws {@link GoldenError} with a clear message. */
export async function readGoldenSet(dir: string): Promise<GoldenSet> {
  const manifestPath = join(dir, 'manifest.json');
  let manifestRaw: string;
  try {
    manifestRaw = await readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new GoldenError(
      `No golden manifest at ${manifestPath}. Run \`vexyo record\` to create one.`,
      err,
    );
  }
  const manifest = parseGolden(GoldenManifestSchema, manifestRaw, manifestPath);

  const recordings: GoldenRecording[] = [];
  const recordingsDir = join(dir, 'recordings');
  let files: string[] = [];
  try {
    files = (await readdir(recordingsDir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    files = []; // manifest-only golden set: schema/coverage drift still work
  }
  for (const file of files) {
    const path = join(recordingsDir, file);
    recordings.push(parseGolden(GoldenRecordingSchema, await readFile(path, 'utf8'), path));
  }

  return { manifest, recordings };
}

function parseGolden<T>(schema: z.ZodType<T>, raw: string, path: string): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new GoldenError(`Golden at ${path} is not valid JSON.`, err);
  }

  const parsed = schema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }

  const version = isRecord(json) ? json['formatVersion'] : undefined;
  if (version !== undefined && version !== GOLDEN_FORMAT_VERSION) {
    throw new GoldenError(
      `Golden at ${path} has formatVersion ${String(version)}, but this build expects ` +
        `${GOLDEN_FORMAT_VERSION}. Re-run \`vexyo record\` or upgrade vexyo.`,
    );
  }
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new GoldenError(`Golden at ${path} is malformed:\n${issues}`);
}

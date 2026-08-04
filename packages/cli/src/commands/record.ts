import { connectTarget, recordGoldens, TargetConnectionError, writeGoldenSet } from '@vexyo/core';
import { ConfigError, loadConfig, resolveConfigPath, type Config } from '../config';
import { formatStderrBlock, reportHarnessError, reportLaunchFailure } from '../errors';
import { resolveGoldenDir, toGoldenConfig } from '../regression';
import { buildTarget } from '../target';

export interface RecordCommandOptions {
  /** Explicit config path; when omitted, auto-discovered in cwd. */
  config?: string;
  /** Print the target's captured stderr after recording. */
  verbose?: boolean;
}

/**
 * Capture golden files. Connects over the configured transport, snapshots the
 * schema manifest (read-only), and calls only the tools explicitly listed in
 * `regression.record` — never "call everything". Returns 0 on success, 2 on a
 * harness/config error, 3 when the target server failed to start.
 */
export async function recordCommand(opts: RecordCommandOptions): Promise<0 | 2 | 3> {
  let configPath: string;
  let config: Config;
  try {
    configPath = resolveConfigPath(opts.config);
    config = await loadConfig(configPath);
  } catch (err) {
    return reportHarnessError(err);
  }

  if (!config.regression) {
    return reportHarnessError(
      new ConfigError('No `regression` block in the config — nothing to record.'),
    );
  }

  const goldenDir = resolveGoldenDir(configPath, config.regression);
  const goldenCfg = toGoldenConfig(config.specVersion, config.regression);

  const toolCount = Object.keys(goldenCfg.tools).length;
  process.stdout.write(
    toolCount === 0
      ? 'No tools configured under `regression.record`; recording manifest only.\n'
      : `Recording ${toolCount} tool(s): ${Object.keys(goldenCfg.tools).sort().join(', ')}\n`,
  );

  let conn: Awaited<ReturnType<typeof connectTarget>>;
  try {
    conn = await connectTarget(buildTarget(config));
  } catch (err) {
    return err instanceof TargetConnectionError
      ? reportLaunchFailure(err)
      : reportHarnessError(err);
  }

  try {
    const set = await recordGoldens(conn.client, goldenCfg);
    const written = await writeGoldenSet(goldenDir, set);
    process.stdout.write(`Wrote ${written.length} golden file(s) to ${goldenDir}:\n`);
    for (const path of written) {
      process.stdout.write(`  ${path}\n`);
    }
    return 0;
  } catch (err) {
    return reportHarnessError(err);
  } finally {
    await conn.close().catch(() => undefined);
    const stderr = conn.serverStderr?.();
    if (opts.verbose && stderr && stderr.text !== '') {
      process.stderr.write(formatStderrBlock(stderr.text, stderr.truncated));
    }
  }
}

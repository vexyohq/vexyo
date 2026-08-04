import {
  readGoldenSet,
  runRegression,
  runSuite,
  TargetConnectionError,
  type RunResult,
  type RunSuiteOptions,
  type Severity,
  type SpecVersion,
} from '@vexyo/core';
import {
  consoleReporter,
  jsonReporter,
  junitReporter,
  markdownReporter,
  type Reporter,
} from '@vexyo/reporters';
import { ConfigError, loadConfig, resolveConfigPath, type Config } from '../config';
import { formatStderrBlock, reportHarnessError, reportLaunchFailure } from '../errors';
import { resolveGoldenDir, toGoldenConfig } from '../regression';
import { buildTarget } from '../target';

export interface RunCommandOptions {
  /** Explicit config path; when omitted, auto-discovered in cwd. */
  config?: string;
  specVersion?: string;
  reporter: string;
  regression?: boolean;
  failOn?: string;
  /** Print the target's captured stderr after the report. */
  verbose?: boolean;
}

export interface ExecuteRunOptions {
  /** Explicit config path; when omitted, auto-discovered in cwd. */
  config?: string;
  specVersion?: string;
  regression?: boolean;
  failOn?: string;
}

const REPORTERS: Record<string, Reporter> = {
  console: consoleReporter,
  json: jsonReporter,
  markdown: markdownReporter,
  junit: junitReporter,
};

/**
 * Load config, connect over the configured transport, run the conformance suite
 * (plus regression when requested), and return the {@link RunResult}. Throws
 * `ConfigError`/`GoldenError` (callers map to exit 2) or `TargetConnectionError`
 * (exit 3). Shared by the `run` command and the GitHub Action.
 */
export async function executeRun(opts: ExecuteRunOptions): Promise<RunResult> {
  const configPath = resolveConfigPath(opts.config);
  const config = await loadConfig(configPath);
  const specVersion = resolveSpecVersion(opts.specVersion, config);
  const failOn = resolveFailOn(opts.failOn, config);
  const extraChecks = await buildRegressionPhase(opts, configPath, config, specVersion);

  return runSuite({
    specVersion,
    target: buildTarget(config),
    failOn,
    extraChecks,
  });
}

/**
 * Execute the `run` command. Returns the process exit code:
 * 0 = pass, 1 = findings at/above threshold, 2 = harness/config error,
 * 3 = the target server failed to start / was unreachable.
 */
export async function runCommand(opts: RunCommandOptions): Promise<0 | 1 | 2 | 3> {
  const reporter = REPORTERS[opts.reporter];
  if (!reporter) {
    return reportHarnessError(
      new ConfigError(
        `Unknown reporter "${opts.reporter}". Available reporters: ${Object.keys(REPORTERS).join(', ')}.`,
      ),
    );
  }

  let result: RunResult;
  try {
    result = await executeRun(opts);
  } catch (err) {
    if (err instanceof TargetConnectionError) {
      // With the json reporter, stdout additionally gets a structured document
      // (outcome discriminator) so sweep tooling never has to parse prose.
      if (opts.reporter === 'json') {
        process.stdout.write(`${JSON.stringify(launchFailureDoc(err), null, 2)}\n`);
      }
      return reportLaunchFailure(err);
    }
    return reportHarnessError(err);
  }

  process.stdout.write(`${reporter.format(result)}\n`);
  if (opts.verbose && result.serverStderr) {
    process.stderr.write(
      formatStderrBlock(result.serverStderr.text, result.serverStderr.truncated),
    );
  }
  return result.exitCode;
}

/** Structured counterpart of a completed RunResult (`outcome: 'completed'`). */
function launchFailureDoc(err: TargetConnectionError): Record<string, unknown> {
  return {
    outcome: 'launch-failure',
    target: { transport: err.transport, description: err.targetDescription },
    error: err.message,
    cause: err.cause instanceof Error ? err.cause.message : err.cause,
    serverStderr: { text: err.stderr, truncated: err.truncated },
    exitCode: 3,
  };
}

function resolveSpecVersion(override: string | undefined, config: Config): SpecVersion {
  const specVersion = (override as SpecVersion | undefined) ?? config.specVersion;
  if (specVersion !== '2025-11-25') {
    throw new ConfigError(
      `Spec version "${specVersion}" is not wired up in this build. Only 2025-11-25 is supported.`,
    );
  }
  return specVersion;
}

function resolveFailOn(override: string | undefined, config: Config): Severity {
  return (override as Severity | undefined) ?? config.regression?.failOn ?? 'error';
}

async function buildRegressionPhase(
  opts: ExecuteRunOptions,
  configPath: string,
  config: Config,
  specVersion: SpecVersion,
): Promise<RunSuiteOptions['extraChecks']> {
  if (!opts.regression) {
    return undefined;
  }
  if (!config.regression) {
    throw new ConfigError('`--regression` requires a `regression` block in the config.');
  }
  const goldenSet = await readGoldenSet(resolveGoldenDir(configPath, config.regression));
  const goldenCfg = toGoldenConfig(specVersion, config.regression);
  return (ctx) => runRegression(ctx.client, goldenSet, goldenCfg);
}

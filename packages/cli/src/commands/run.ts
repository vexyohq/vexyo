import {
  readGoldenSet,
  runRegression,
  runSuite,
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
import { ConfigError, loadConfig, type Config } from '../config';
import { reportHarnessError } from '../errors';
import { resolveGoldenDir, toGoldenConfig } from '../regression';
import { buildTarget } from '../target';

export interface RunCommandOptions {
  config: string;
  specVersion?: string;
  reporter: string;
  regression?: boolean;
  failOn?: string;
}

export interface ExecuteRunOptions {
  config: string;
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
 * `ConfigError`/`GoldenError`/connection errors for anything the caller should
 * map to exit code 2. Shared by the `run` command and the GitHub Action.
 */
export async function executeRun(opts: ExecuteRunOptions): Promise<RunResult> {
  const config = await loadConfig(opts.config);
  const specVersion = resolveSpecVersion(opts.specVersion, config);
  const failOn = resolveFailOn(opts.failOn, config);
  const extraChecks = await buildRegressionPhase(opts, config, specVersion);

  return runSuite({
    specVersion,
    target: buildTarget(config),
    failOn,
    extraChecks,
  });
}

/**
 * Execute the `run` command. Returns the process exit code:
 * 0 = pass, 1 = findings at/above threshold, 2 = harness/config error.
 */
export async function runCommand(opts: RunCommandOptions): Promise<0 | 1 | 2> {
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
    return reportHarnessError(err);
  }

  process.stdout.write(`${reporter.format(result)}\n`);
  return result.exitCode;
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
  config: Config,
  specVersion: SpecVersion,
): Promise<RunSuiteOptions['extraChecks']> {
  if (!opts.regression) {
    return undefined;
  }
  if (!config.regression) {
    throw new ConfigError('`--regression` requires a `regression` block in the config.');
  }
  const goldenSet = await readGoldenSet(resolveGoldenDir(opts.config, config.regression));
  const goldenCfg = toGoldenConfig(specVersion, config.regression);
  return (ctx) => runRegression(ctx.client, goldenSet, goldenCfg);
}

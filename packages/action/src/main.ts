import { writeFile } from 'node:fs/promises';
import * as core from '@actions/core';
import { executeRun } from '@vexyo/cli/api';
import { junitReporter, markdownReporter } from '@vexyo/reporters';
import { annotate } from './annotate';
import { parseInputs } from './inputs';

/**
 * GitHub Action entry point. Thin wrapper over the CLI's `executeRun`: validate
 * inputs → run → publish the markdown report as the job summary, emit PR
 * annotations, optionally write JUnit, and fail precisely on the run's exit code.
 */
export async function run(): Promise<void> {
  const inputs = parseInputs({
    config: core.getInput('config', { required: true }),
    specVersion: core.getInput('spec-version') || undefined,
    regression: core.getInput('regression') || undefined,
    failOn: core.getInput('fail-on') || undefined,
    junitFile: core.getInput('junit-file') || undefined,
  });

  const result = await executeRun({
    config: inputs.config,
    specVersion: inputs.specVersion,
    regression: inputs.regression,
    failOn: inputs.failOn,
  });

  await core.summary.addRaw(markdownReporter.format(result)).write();

  for (const a of annotate(result)) {
    const properties = { title: `vexyo: ${a.title}` };
    if (a.severity === 'error') {
      core.error(a.message, properties);
    } else {
      core.warning(a.message, properties);
    }
  }

  if (inputs.junitFile) {
    await writeFile(inputs.junitFile, junitReporter.format(result));
  }

  if (result.exitCode !== 0) {
    core.setFailed(
      `vexyo found ${result.summary.fail} failure(s) and ${result.summary.error} error(s).`,
    );
  }
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});

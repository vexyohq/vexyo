import type { TargetConnectionError } from '@vexyo/core';

/** Print a harness/config error (with its cause, if any) and return exit code 2. */
export function reportHarnessError(err: unknown): 2 {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`error: ${message}\n`);
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause !== undefined) {
    process.stderr.write(`  cause: ${cause instanceof Error ? cause.message : String(cause)}\n`);
  }
  return 2;
}

/**
 * Delimited rendering of a target server's captured stderr. Pure — shared by
 * the CLI (verbose + launch-failure paths) and the GitHub Action.
 */
export function formatStderrBlock(stderr: string, truncated: boolean): string {
  if (stderr === '') {
    return '(no stderr captured from the target server)\n';
  }
  const label = truncated ? 'captured, truncated to the last 64KB' : 'captured';
  const body = stderr.endsWith('\n') ? stderr : `${stderr}\n`;
  return `--- target stderr (${label}) ---\n${body}--- end target stderr ---\n`;
}

/**
 * Print a target-launch/connection failure and return exit code 3. Unlike
 * {@link reportHarnessError} (exit 2 — the user's invocation is at fault),
 * this states plainly that the TARGET did not start, then always prints the
 * captured child stderr — for a crashed server it is the only diagnostic.
 */
export function reportLaunchFailure(err: TargetConnectionError): 3 {
  process.stderr.write(`error: ${err.message}\n`);
  if (err.cause !== undefined) {
    process.stderr.write(
      `  cause: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}\n`,
    );
  }
  process.stderr.write(formatStderrBlock(err.stderr, err.truncated));
  return 3;
}

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

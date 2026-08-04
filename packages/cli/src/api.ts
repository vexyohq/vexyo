// Non-executing entry point for programmatic consumers (e.g. the GitHub Action).
// Importing this never starts the commander program (unlike the `.` bin entry).
export { executeRun } from './commands/run';
export type { ExecuteRunOptions } from './commands/run';
// Re-exported for the Action, which has no direct @vexyo/core dependency.
export { TargetConnectionError } from '@vexyo/core';
export { formatStderrBlock } from './errors';

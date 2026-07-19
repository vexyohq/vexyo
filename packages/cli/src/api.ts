// Non-executing entry point for programmatic consumers (e.g. the GitHub Action).
// Importing this never starts the commander program (unlike the `.` bin entry).
export { executeRun } from './commands/run';
export type { ExecuteRunOptions } from './commands/run';

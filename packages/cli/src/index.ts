#!/usr/bin/env -S node --import tsx
import { BRAND } from '@vexyo/core';
import { Command } from 'commander';
import { recordCommand } from './commands/record';
import { runCommand } from './commands/run';

const program = new Command();

program.name(BRAND.bin).description('CI-native conformance harness for MCP servers');

program
  .command('run')
  .description('Run the conformance suite (and optionally regression) against an MCP server')
  .requiredOption('-c, --config <path>', 'path to the vexyo config file')
  .option('-s, --spec-version <version>', 'override the spec version to target')
  .option('-r, --reporter <name>', 'output reporter (console, json, markdown)', 'console')
  .option('--regression', 'also diff current behavior against the recorded golden set')
  .option('--fail-on <severity>', 'severity at/above which findings fail the run (error, warning)')
  .action(
    async (opts: {
      config: string;
      specVersion?: string;
      reporter: string;
      regression?: boolean;
      failOn?: string;
    }) => {
      const code = await runCommand({
        config: opts.config,
        specVersion: opts.specVersion,
        reporter: opts.reporter,
        regression: opts.regression,
        failOn: opts.failOn,
      });
      process.exit(code);
    },
  );

program
  .command('record')
  .description('Record golden files for the tools configured under `regression.record`')
  .requiredOption('-c, --config <path>', 'path to the vexyo config file')
  .action(async (opts: { config: string }) => {
    const code = await recordCommand({ config: opts.config });
    process.exit(code);
  });

// `pnpm vexyo -- run ...` forwards the `--` separator literally; drop a
// leading one so both that and `pnpm vexyo run ...` parse identically.
const argv = process.argv.slice();
if (argv[2] === '--') argv.splice(2, 1);

program.parseAsync(argv).catch((err: unknown) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});

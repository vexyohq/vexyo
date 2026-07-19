#!/usr/bin/env node
import { BRAND } from '@vexyo/core';
import { Command } from 'commander';
import { initCommand, type InitTransport } from './commands/init';
import { recordCommand } from './commands/record';
import { runCommand } from './commands/run';

const program = new Command();

program.name(BRAND.bin).description('CI-native conformance harness for MCP servers');

program
  .command('run')
  .description('Run the conformance suite (and optionally regression) against an MCP server')
  .option(
    '-c, --config <path>',
    'path to the vexyo config file (auto-discovered in cwd if omitted)',
  )
  .option('-s, --spec-version <version>', 'override the spec version to target')
  .option('-r, --reporter <name>', 'output reporter (console, json, markdown)', 'console')
  .option('--regression', 'also diff current behavior against the recorded golden set')
  .option('--fail-on <severity>', 'severity at/above which findings fail the run (error, warning)')
  .action(
    async (opts: {
      config?: string;
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
  .option(
    '-c, --config <path>',
    'path to the vexyo config file (auto-discovered in cwd if omitted)',
  )
  .action(async (opts: { config?: string }) => {
    const code = await recordCommand({ config: opts.config });
    process.exit(code);
  });

program
  .command('init')
  .description('Scaffold a vexyo.config.ts in the current directory')
  .option('-t, --transport <kind>', 'target transport for the template (stdio, http)', 'stdio')
  .option('-f, --force', 'overwrite an existing vexyo.config.ts')
  .action(async (opts: { transport: string; force?: boolean }) => {
    if (opts.transport !== 'stdio' && opts.transport !== 'http') {
      process.stderr.write(`error: --transport must be "stdio" or "http".\n`);
      process.exit(2);
    }
    const code = await initCommand({
      transport: opts.transport as InitTransport,
      force: Boolean(opts.force),
    });
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

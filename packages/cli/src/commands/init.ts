import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigError, DEFAULT_SPEC_VERSION } from '../config';
import { reportHarnessError } from '../errors';

export type InitTransport = 'stdio' | 'http';

export interface InitCommandOptions {
  transport: InitTransport;
  force: boolean;
  /** Directory to write into (defaults to cwd); injectable for tests. */
  cwd?: string;
}

const CONFIG_FILENAME = 'vexyo.config.ts';

/**
 * Render a `vexyo.config.ts` template. The chosen transport's target is active;
 * the other shapes (and a regression block) are included commented out. Pure —
 * no filesystem — so the scaffold output is snapshot-testable.
 */
export function renderConfigTemplate(transport: InitTransport, specVersion: string): string {
  const activeTarget =
    transport === 'http'
      ? `  target: {
    transport: 'http',
    url: 'http://127.0.0.1:3000/mcp',
    // headers: { Authorization: 'Bearer <your-token>' },
  },`
      : `  target: {
    transport: 'stdio',
    command: 'node',
    args: ['path/to/your/mcp-server.js'],
    // cwd: '.',
    // env: { API_KEY: 'value' },
  },`;

  const alternatives =
    transport === 'http'
      ? `  // --- Alternative targets (uncomment one, comment out the http target above) ---
  //
  // Node (stdio):
  // target: { transport: 'stdio', command: 'node', args: ['path/to/your/mcp-server.js'] },
  //
  // Python / other runtimes (stdio):
  // target: { transport: 'stdio', command: 'python', args: ['-m', 'your_mcp_server'] },`
      : `  // --- Alternative targets (uncomment one, comment out the stdio target above) ---
  //
  // Python / other runtimes (stdio):
  // target: { transport: 'stdio', command: 'python', args: ['-m', 'your_mcp_server'] },
  //
  // Streamable HTTP (a running server):
  // target: { transport: 'http', url: 'http://127.0.0.1:3000/mcp' },`;

  return `import { defineConfig } from '@vexyo/cli/config';

export default defineConfig({
  specVersion: '${specVersion}',

  // The MCP server under test.
${activeTarget}

${alternatives}

  // --- Regression testing (optional) ---
  // Record golden tool outputs with \`vexyo record\`, then \`vexyo run --regression\`
  // fails when behavior drifts.
  // regression: {
  //   goldenDir: 'vexyo/goldens',
  //   normalizers: ['iso-timestamp', 'uuid'],
  //   record: {
  //     // greet: { cases: [{ case: 'basic', arguments: { name: 'world' } }] },
  //   },
  // },
});
`;
}

/**
 * Scaffold a `vexyo.config.ts` in cwd. Refuses to overwrite an existing file
 * without `--force`. Returns 0 on success, 2 on any error.
 */
export async function initCommand(opts: InitCommandOptions): Promise<0 | 2> {
  const cwd = opts.cwd ?? process.cwd();
  const target = resolve(cwd, CONFIG_FILENAME);

  if (existsSync(target) && !opts.force) {
    return reportHarnessError(
      new ConfigError(`${CONFIG_FILENAME} already exists. Pass --force to overwrite it.`),
    );
  }

  try {
    await writeFile(target, renderConfigTemplate(opts.transport, DEFAULT_SPEC_VERSION));
  } catch (err) {
    return reportHarnessError(err);
  }

  process.stdout.write(
    `Created ${CONFIG_FILENAME}.\n\n` +
      `Next steps:\n` +
      `  1. Edit the \`target\` to point at your MCP server.\n` +
      `  2. vexyo run --config ${CONFIG_FILENAME}\n`,
  );
  return 0;
}

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BRAND } from '../brand';
import type { ConnectedClient, StdioTargetConfig } from './types';

export type { StdioTargetConfig } from './types';

/**
 * Spawn the target server over stdio and complete the MCP handshake using the
 * official SDK (CLAUDE.md hard rule #1). Over stdio the client transport owns
 * the spawned process, so `close()` also terminates the server. Callers must
 * always `close()` the returned handle to avoid leaking the child process.
 */
export async function connectStdio(target: StdioTargetConfig): Promise<ConnectedClient> {
  const transport = new StdioClientTransport({
    command: target.command,
    args: target.args,
    cwd: target.cwd,
    // When env is omitted the SDK supplies a safe default (PATH/HOME/etc.).
    env: target.env,
    stderr: 'inherit',
  });

  const client = new Client(
    { name: `${BRAND.name}-probe`, version: '0.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
  } catch (err) {
    await transport.close().catch(() => undefined);
    throw new Error(
      `Failed to connect to an MCP server over stdio (command: ${target.command}). ` +
        'Check that the command starts a stdio MCP server and exits cleanly on stdin close.',
      { cause: err },
    );
  }

  return {
    client,
    transport: { kind: 'stdio' },
    close: async () => {
      await client.close();
    },
  };
}

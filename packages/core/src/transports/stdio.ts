import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BRAND } from '../brand';
import { TargetConnectionError } from './errors';
import { captureNegotiatedProtocolVersion } from './protocol-version';
import { createStderrTail } from './stderr';
import type { ConnectedClient, StdioTargetConfig } from './types';

export type { StdioTargetConfig } from './types';

/**
 * Spawn the target server over stdio and complete the MCP handshake using the
 * official SDK (CLAUDE.md hard rule #1). Over stdio the client transport owns
 * the spawned process, so `close()` also terminates the server. Callers must
 * always `close()` the returned handle to avoid leaking the child process.
 *
 * The child's stderr is CAPTURED (bounded tail), never inherited: a chatty
 * server cannot drown the report. On connect failure it rides on the thrown
 * {@link TargetConnectionError}; on success it is exposed via
 * {@link ConnectedClient.serverStderr}.
 */
export async function connectStdio(target: StdioTargetConfig): Promise<ConnectedClient> {
  const transport = new StdioClientTransport({
    command: target.command,
    args: target.args,
    cwd: target.cwd,
    // When env is omitted the SDK supplies a safe default (PATH/HOME/etc.).
    env: target.env,
    stderr: 'pipe',
  });

  // The SDK creates the PassThrough at construction, so attaching before
  // connect() loses nothing — and Node only fires the child `close` (which
  // rejects the handshake) after stderr ends, so the tail is complete by the
  // time the catch below runs.
  const tail = createStderrTail();
  transport.stderr?.on('data', (chunk: Buffer) => tail.append(chunk));

  const negotiatedProtocolVersion = captureNegotiatedProtocolVersion(transport, 'stdio target');

  const client = new Client(
    { name: `${BRAND.name}-probe`, version: '0.0.0' },
    { capabilities: {} },
  );

  const description = `stdio: ${target.command} ${(target.args ?? []).join(' ')}`.trim();

  try {
    await client.connect(transport);
  } catch (err) {
    await transport.close().catch(() => undefined);
    const captured = tail.snapshot();
    throw new TargetConnectionError({
      message:
        `The target MCP server failed to start (${description}). ` +
        'Check that the command starts a stdio MCP server; its stderr is below.',
      transport: 'stdio',
      targetDescription: description,
      stderr: captured.text,
      truncated: captured.truncated,
      cause: err,
    });
  }

  return {
    client,
    transport: { kind: 'stdio' },
    negotiatedProtocolVersion: negotiatedProtocolVersion(),
    serverStderr: () => tail.snapshot(),
    close: async () => {
      await client.close();
    },
  };
}

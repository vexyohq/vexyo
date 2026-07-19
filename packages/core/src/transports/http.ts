import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BRAND } from '../brand';
import type { ConnectedClient, HttpTargetConfig } from './types';

export type { HttpTargetConfig } from './types';

/**
 * Connect to a running Streamable HTTP MCP server and complete the handshake
 * using the official SDK. The server is not ours to manage — over HTTP the
 * runner owns only the connection: `connect()` performs initialize (and the SDK
 * captures the `Mcp-Session-Id` the server issues), `close()` ends the session
 * (the SDK sends the terminating `DELETE`). Rules never touch the session or
 * HTTP verbs; the negotiated session id is surfaced via {@link ConnectedClient.transport}.
 */
export async function connectHttp(target: HttpTargetConfig): Promise<ConnectedClient> {
  let url: URL;
  try {
    url = new URL(target.url);
  } catch (err) {
    throw new Error(`Invalid HTTP target url: ${target.url}`, { cause: err });
  }

  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: target.headers ? { headers: target.headers } : undefined,
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
      `Failed to connect to an MCP server over Streamable HTTP (url: ${target.url}). ` +
        'Check that the server is running and the URL points at its MCP endpoint.',
      { cause: err },
    );
  }

  return {
    client,
    transport: { kind: 'http', sessionId: transport.sessionId },
    close: async () => {
      await client.close();
    },
  };
}

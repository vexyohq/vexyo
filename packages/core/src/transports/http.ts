import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BRAND } from '../brand';
import { TargetConnectionError } from './errors';
import { captureNegotiatedProtocolVersion } from './protocol-version';
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

  // Chains the transport's own setProtocolVersion (which stamps subsequent
  // request headers), recording the negotiated version on the way through.
  const negotiatedProtocolVersion = captureNegotiatedProtocolVersion(transport, 'http target');

  const client = new Client(
    { name: `${BRAND.name}-probe`, version: '0.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
  } catch (err) {
    await transport.close().catch(() => undefined);
    // Same triage class as a failed stdio launch ("vexyo could not reach the
    // target" → exit 3); the malformed-URL throw above stays a plain error —
    // that one is a config mistake (exit 2).
    throw new TargetConnectionError({
      message:
        `The target MCP server is unreachable (url: ${target.url}). ` +
        'Check that the server is running and the URL points at its MCP endpoint.',
      transport: 'http',
      targetDescription: `http: ${target.url}`,
      stderr: '',
      truncated: false,
      cause: err,
    });
  }

  return {
    client,
    transport: { kind: 'http', sessionId: transport.sessionId },
    negotiatedProtocolVersion: negotiatedProtocolVersion(),
    close: async () => {
      await client.close();
    },
  };
}

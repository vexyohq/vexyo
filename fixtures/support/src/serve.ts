import { randomUUID } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

/** Anything the SDK can attach a transport to (McpServer or low-level Server). */
export interface ConnectableServer {
  connect(transport: Transport): Promise<void>;
}

/** Builds a fresh server instance for the given defect (fresh per HTTP session). */
export type CreateServer = (defect: string) => ConnectableServer;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Run a fixture over the transport selected on argv. This is the single place
 * the fixture packages share so every fixture is runnable over both stdio and
 * Streamable HTTP without duplicating the HTTP plumbing.
 *
 *   --transport stdio|http   (default stdio)
 *   --port <n>               (http; 0 = ephemeral)
 *   --defect <id>            (passed to createServer)
 *   --http-defect <id>       (transport-level defect, e.g. bad-session-id)
 */
export async function serve(createServer: CreateServer): Promise<void> {
  const transport = argValue('--transport') ?? 'stdio';
  const defect = argValue('--defect') ?? '';
  if (transport === 'http') {
    await serveHttp(createServer, defect);
  } else {
    await createServer(defect).connect(new StdioServerTransport());
  }
}

async function serveHttp(createServer: CreateServer, defect: string): Promise<void> {
  const port = Number(argValue('--port') ?? '0');
  const httpDefect = argValue('--http-defect') ?? '';
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // A `bad-session-id` session id contains a space — a valid HTTP header value
  // but outside the visible-ASCII range the MCP spec requires.
  const sessionIdGenerator = httpDefect === 'bad-session-id' ? () => 'bad id' : () => randomUUID();

  const httpServer = createHttpServer((req, res) => {
    handle(req, res, createServer, defect, sessions, sessionIdGenerator).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(err));
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve));
  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  process.stdout.write(`VEXYO_PORT=${boundPort}\n`);
  process.stdout.write('VEXYO_READY\n');
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  createServer: CreateServer,
  defect: string,
  sessions: Map<string, StreamableHTTPServerTransport>,
  sessionIdGenerator: () => string,
): Promise<void> {
  const header = req.headers['mcp-session-id'];
  const sessionId = Array.isArray(header) ? header[0] : header;

  const existing = sessionId ? sessions.get(sessionId) : undefined;
  if (existing) {
    await existing.handleRequest(req, res, await readBody(req));
    return;
  }

  const body = req.method === 'POST' ? await readBody(req) : undefined;
  if (req.method === 'POST' && isInitializeRequest(body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator,
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });
    await createServer(defect).connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  res.writeHead(400, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Bad Request: no valid session' },
    }),
  );
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}

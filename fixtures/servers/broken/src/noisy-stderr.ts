/**
 * A fully functional server that floods stderr while behaving normally —
 * models e.g. a Python-SDK server logging a pydantic warning per request.
 * Mirrors the compliant fixture's surface (tools/resource/prompt) so the full
 * conformance suite passes; the ONLY defect is the noise.
 *
 * Emits 2000 numbered ~100-byte lines (≈190 KB, comfortably past the 64 KB
 * capture cap) before serving, so tests can assert the tail is kept (late
 * line numbers) and the head is dropped (line 0001 absent, truncated=true).
 */
import { serve } from '@vexyo/fixture-support';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const LINE_COUNT = 2000;
const PADDING = 'x'.repeat(70);
for (let i = 1; i <= LINE_COUNT; i += 1) {
  process.stderr.write(`noisy-stderr warning ${String(i).padStart(4, '0')} ${PADDING}\n`);
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'vexyo-noisy-stderr-fixture', version: '1.0.0' },
    { instructions: 'Compliant server that floods stderr; used by stderr-capture tests.' },
  );

  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Returns the provided text verbatim.',
      inputSchema: { text: z.string() },
    },
    ({ text }) => ({ content: [{ type: 'text', text }] }),
  );

  server.registerTool(
    'add',
    {
      title: 'Add',
      description: 'Adds two numbers.',
      inputSchema: { a: z.number(), b: z.number() },
    },
    ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }),
  );

  server.registerResource(
    'readme',
    'vexyo://readme',
    { title: 'Readme', description: 'Fixture readme.', mimeType: 'text/plain' },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'vexyo noisy fixture.' }],
    }),
  );

  server.registerPrompt(
    'greet',
    {
      title: 'Greet',
      description: 'Produces a greeting.',
      argsSchema: { name: z.string() },
    },
    ({ name }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `Hello, ${name}!` } }],
    }),
  );

  return server;
}

await serve(() => createServer());

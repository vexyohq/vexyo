/**
 * A minimal, fully spec-compliant MCP server used as the "pass" fixture for
 * every rule (CLAUDE.md hard rule #3). Runnable over stdio or Streamable HTTP
 * via the shared `serve` helper. Correctly implements tools, resources, and
 * prompts so every rule reaches status `pass`, not `skip`.
 */
import { serve } from '@vexyo/fixture-support';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'vexyo-compliant-fixture', version: '1.0.0' },
    {
      instructions: 'A reference-compliant MCP server used to validate vexyo conformance rules.',
    },
  );

  // --- Tools (≥2, unique names, real object input schemas) ---
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

  // --- Resource (readable) ---
  server.registerResource(
    'readme',
    'vexyo://readme',
    { title: 'Readme', description: 'Fixture readme.', mimeType: 'text/plain' },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'vexyo compliant fixture.' }],
    }),
  );

  // --- Prompt ---
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

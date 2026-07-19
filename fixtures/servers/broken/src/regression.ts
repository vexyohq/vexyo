/**
 * Fixture for the M2 regression engine. With `--defect none` it is the stable
 * baseline the committed goldens are recorded from; each other defect produces
 * exactly one drift class. Runnable over stdio or HTTP.
 *
 *   --defect none                → baseline (record goldens from this)
 *   --defect tool-output-changed → behavioral drift (echo output differs)
 *   --defect tool-schema-changed → schema drift (echo inputSchema type flipped)
 *   --defect tool-removed        → coverage drift (removed): `add` disappears
 *   --defect tool-added          → coverage drift (added): extra `search` tool
 *
 * `stamp` returns a fresh timestamp + uuid on every call, exercising the
 * normalizers: its golden is stable only because they collapse both values.
 */
import { randomUUID } from 'node:crypto';
import { serve } from '@vexyo/fixture-support';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { raw } from './shared';

const addDef = {
  name: 'add',
  title: 'Add',
  inputSchema: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
};
const stampDef = { name: 'stamp', title: 'Stamp', inputSchema: { type: 'object', properties: {} } };
const searchDef = {
  name: 'search',
  title: 'Search',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
};

export function createServer(defect: string): Server {
  const server = new Server(
    { name: 'vexyo-regression-fixture', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  const echoDef = {
    name: 'echo',
    title: 'Echo',
    inputSchema: {
      type: 'object',
      properties: { text: { type: defect === 'tool-schema-changed' ? 'number' : 'string' } },
      required: ['text'],
    },
  };

  server.setRequestHandler(ListToolsRequestSchema, () => {
    const tools = [echoDef, stampDef];
    if (defect !== 'tool-removed') {
      tools.push(addDef);
    }
    if (defect === 'tool-added') {
      tools.push(searchDef);
    }
    return raw({ tools });
  });

  server.setRequestHandler(ListResourcesRequestSchema, () =>
    raw({ resources: [{ uri: 'vexyo://readme', name: 'readme' }] }),
  );

  server.setRequestHandler(ListPromptsRequestSchema, () => raw({ prompts: [{ name: 'greet' }] }));

  server.setRequestHandler(CallToolRequestSchema, (req) => {
    const name = req.params.name;
    const args = req.params.arguments ?? {};

    if (name === 'echo') {
      const text = args['text'];
      if (typeof text !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Missing required argument "text".');
      }
      return raw({
        content: [
          { type: 'text', text: defect === 'tool-output-changed' ? `${text} (changed)` : text },
        ],
      });
    }
    if (name === 'add') {
      return raw({
        content: [{ type: 'text', text: String(Number(args['a']) + Number(args['b'])) }],
      });
    }
    if (name === 'stamp') {
      return raw({
        content: [
          { type: 'text', text: `stamped at ${new Date().toISOString()} id ${randomUUID()}` },
        ],
      });
    }
    throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
  });

  return server;
}

await serve(createServer);

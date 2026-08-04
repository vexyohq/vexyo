/**
 * Broken fixture for the `error-semantics` rule family. Advertises tools and
 * resources; error handling is correct except for the selected defect. Runnable
 * over stdio or HTTP.
 *
 *   --defect unknown-method-ok   → responds to an unsupported method with a result
 *   --defect unknown-tool-ok     → tools/call on any name returns success
 *   --defect invalid-params-ok   → tools/call ignores argument validation
 *   --defect unknown-resource-ok → resources/read on any uri returns success
 *   --defect empty-error-message → errors carry an empty message
 */
import { serve } from '@vexyo/fixture-support';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { BareError, PROBE_UNSUPPORTED_METHOD, raw } from './shared';

const echoTool = {
  name: 'echo',
  description: 'Echo',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
};

// Must match UNKNOWN_METHOD in packages/core/src/rules/2025-11-25/errors/error-object-shape.ts
const ERROR_SHAPE_PROBE = 'vexyo/__vexyo_error_shape_probe__';

export function createServer(defect: string): Server {
  const server = new Server(
    { name: 'vexyo-broken-errors', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => raw({ tools: [echoTool] }));

  server.setRequestHandler(CallToolRequestSchema, (req) => {
    const name = req.params.name;
    const text = req.params.arguments?.['text'];

    if (defect === 'unknown-tool-ok' || defect === 'invalid-params-ok') {
      return raw({ content: [{ type: 'text', text: 'ok' }] });
    }
    if (defect === 'empty-error-message') {
      throw new BareError(ErrorCode.InvalidParams);
    }
    if (name !== 'echo') {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    }
    if (typeof text !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing required argument "text".');
    }
    return raw({ content: [{ type: 'text', text }] });
  });

  server.setRequestHandler(ReadResourceRequestSchema, (req) => {
    if (defect === 'unknown-resource-ok') {
      return raw({ contents: [] });
    }
    if (defect === 'empty-error-message') {
      throw new BareError(ErrorCode.InvalidParams);
    }
    throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${req.params.uri}`);
  });

  // error-object-shape provokes its error with an unknown method, so this
  // defect must mangle that error too, not just tool/resource errors.
  if (defect === 'empty-error-message') {
    const shapeProbeSchema = z.object({
      method: z.literal(ERROR_SHAPE_PROBE),
      params: z.unknown().optional(),
    });
    server.setRequestHandler(shapeProbeSchema, () => {
      throw new BareError(ErrorCode.MethodNotFound);
    });
  }

  // Only under this defect does the server (wrongly) answer an unsupported method.
  if (defect === 'unknown-method-ok') {
    const probeSchema = z.object({
      method: z.literal(PROBE_UNSUPPORTED_METHOD),
      params: z.unknown().optional(),
    });
    server.setRequestHandler(probeSchema, () => raw({}));
  }

  return server;
}

await serve(createServer);

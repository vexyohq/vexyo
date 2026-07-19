/**
 * Broken fixture for the `discovery` rule family. Advertises tools, resources,
 * and prompts and answers every list method with conformant data — except the
 * one method targeted by the selected defect. Runnable over stdio or HTTP.
 *
 *   --defect tools-list-throws    → tools/list errors
 *   --defect tool-empty-name      → a tool has name ""
 *   --defect tool-missing-schema  → a tool lacks inputSchema
 *   --defect tool-duplicate-name  → two tools share a name
 *   --defect resources-list-throws→ resources/list errors
 *   --defect resource-empty-uri   → a resource has uri ""
 *   --defect prompts-list-throws  → prompts/list errors
 *   --defect prompt-empty-name    → a prompt has name ""
 */
import { serve } from '@vexyo/fixture-support';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { raw } from './shared';

const validTool = {
  name: 'echo',
  description: 'Echo',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
};

export function createServer(defect: string): Server {
  const server = new Server(
    { name: 'vexyo-broken-discovery', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => {
    switch (defect) {
      case 'tools-list-throws':
        throw new McpError(ErrorCode.InternalError, 'tools/list is broken');
      case 'tool-empty-name':
        return raw({ tools: [{ name: '', description: '', inputSchema: { type: 'object' } }] });
      case 'tool-missing-schema':
        return raw({ tools: [{ name: 'echo', description: 'no schema' }] });
      case 'tool-duplicate-name':
        return raw({
          tools: [
            { name: 'echo', inputSchema: { type: 'object' } },
            { name: 'echo', inputSchema: { type: 'object' } },
          ],
        });
      default:
        return raw({ tools: [validTool] });
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, () => {
    if (defect === 'resources-list-throws') {
      throw new McpError(ErrorCode.InternalError, 'resources/list is broken');
    }
    if (defect === 'resource-empty-uri') {
      return raw({ resources: [{ uri: '', name: 'readme' }] });
    }
    return raw({ resources: [{ uri: 'vexyo://readme', name: 'readme' }] });
  });

  server.setRequestHandler(ListPromptsRequestSchema, () => {
    if (defect === 'prompts-list-throws') {
      throw new McpError(ErrorCode.InternalError, 'prompts/list is broken');
    }
    if (defect === 'prompt-empty-name') {
      return raw({ prompts: [{ name: '' }] });
    }
    return raw({ prompts: [{ name: 'greet' }] });
  });

  return server;
}

await serve(createServer);

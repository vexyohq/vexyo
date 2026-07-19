import { finding, SkipRule, type Rule } from '../../../rule';
import { isRecord, requireToolList } from '../support';

/**
 * Each tool must declare an `inputSchema` that is a JSON Schema object
 * (`type: "object"`). Clients rely on this to build valid tool calls; a missing
 * or non-object schema is a frequent cause of malformed calls in production.
 */
export const toolsHaveInputSchema: Rule = {
  id: 'discovery/tools-have-input-schema',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'Every tool declares an object inputSchema',
  specRef: 'Server Features §Tools / Tool.inputSchema',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    const tools = await requireToolList(ctx);
    const invalid = tools.filter((tool) => {
      const schema = tool['inputSchema'];
      return !isRecord(schema) || schema['type'] !== 'object';
    });
    if (invalid.length > 0) {
      return [
        finding(
          this,
          `${invalid.length} tool(s) are missing an object inputSchema (type: "object").`,
          'Declare an `inputSchema` of `{ "type": "object", ... }` for every tool.',
          { tools },
        ),
      ];
    }
    return [];
  },
};

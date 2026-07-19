import { finding, SkipRule, type Rule } from '../../../rule';
import { requireToolList, stringField } from '../support';

/** Every tool in `tools/list` must carry a non-empty `name` (its call handle). */
export const toolsHaveNames: Rule = {
  id: 'discovery/tools-have-names',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'Every tool has a non-empty name',
  specRef: 'Server Features §Tools / Tool.name',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    const tools = await requireToolList(ctx);
    const invalid = tools.filter((tool) => {
      const name = stringField(tool, 'name');
      return name === undefined || name.length === 0;
    });
    if (invalid.length > 0) {
      return [
        finding(
          this,
          `${invalid.length} tool(s) have a missing or empty name.`,
          'Give every tool a non-empty string `name`.',
          { tools },
        ),
      ];
    }
    return [];
  },
};

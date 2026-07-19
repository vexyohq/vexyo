import { finding, SkipRule, type Rule } from '../../../rule';
import { requireToolList, stringField } from '../support';

/**
 * Tool names are the call handle and must be unique. Duplicates make tool
 * dispatch ambiguous — the client cannot know which definition a call targets.
 */
export const toolNamesUnique: Rule = {
  id: 'discovery/tool-names-unique',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'Tool names are unique',
  specRef: 'Server Features §Tools / Tool.name',
  async run(ctx) {
    if (!ctx.capabilities?.tools) {
      throw new SkipRule('Server does not advertise the `tools` capability.');
    }
    const tools = await requireToolList(ctx);
    const names = tools.map((tool) => stringField(tool, 'name')).filter((n): n is string => !!n);
    const duplicates = [...new Set(names.filter((name, i) => names.indexOf(name) !== i))];
    if (duplicates.length > 0) {
      return [
        finding(
          this,
          `Duplicate tool name(s): ${duplicates.join(', ')}.`,
          'Ensure every tool has a distinct `name`.',
          { duplicates },
        ),
      ];
    }
    return [];
  },
};

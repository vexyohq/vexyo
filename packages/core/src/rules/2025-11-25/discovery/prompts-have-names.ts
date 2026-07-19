import { finding, SkipRule, type Rule } from '../../../rule';
import { requirePromptList, stringField } from '../support';

/** Every prompt in `prompts/list` must carry a non-empty `name`. */
export const promptsHaveNames: Rule = {
  id: 'discovery/prompts-have-names',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'Every prompt has a non-empty name',
  specRef: 'Server Features §Prompts / Prompt.name',
  async run(ctx) {
    if (!ctx.capabilities?.prompts) {
      throw new SkipRule('Server does not advertise the `prompts` capability.');
    }
    const prompts = await requirePromptList(ctx);
    const invalid = prompts.filter((prompt) => {
      const name = stringField(prompt, 'name');
      return name === undefined || name.length === 0;
    });
    if (invalid.length > 0) {
      return [
        finding(
          this,
          `${invalid.length} prompt(s) have a missing or empty name.`,
          'Give every prompt a non-empty string `name`.',
          { prompts },
        ),
      ];
    }
    return [];
  },
};

import { finding, SkipRule, type Rule } from '../../../rule';
import { requireResourceList, stringField } from '../support';

/**
 * Every resource in `resources/list` must carry a non-empty `uri` — the handle
 * a client uses to read it. A missing or empty uri makes the resource
 * unreadable.
 */
export const resourcesHaveUri: Rule = {
  id: 'discovery/resources-have-uri',
  specVersion: '2025-11-25',
  category: 'discovery',
  severity: 'error',
  title: 'Every resource has a non-empty uri',
  specRef: 'Server Features §Resources / Resource.uri',
  async run(ctx) {
    if (!ctx.capabilities?.resources) {
      throw new SkipRule('Server does not advertise the `resources` capability.');
    }
    const resources = await requireResourceList(ctx);
    const invalid = resources.filter((resource) => {
      const uri = stringField(resource, 'uri');
      return uri === undefined || uri.length === 0;
    });
    if (invalid.length > 0) {
      return [
        finding(
          this,
          `${invalid.length} resource(s) have a missing or empty uri.`,
          'Give every resource a non-empty `uri`.',
          { resources },
        ),
      ];
    }
    return [];
  },
};

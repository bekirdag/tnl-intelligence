import { appProp, clientFor, compact } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-get-weekly-edition',
  name: 'Get Weekly Consequential Edition',
  description: 'Generate the cited TNL weekly consequential-development edition.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    weekEnding: { type: 'string', label: 'Week Ending (UTC)', optional: true },
    category: { type: 'string', label: 'Category', optional: true },
    geography: { type: 'string', label: 'Geography', optional: true },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'get_weekly_edition',
      input: compact({ weekEnding: this.weekEnding, category: this.category, geography: this.geography }),
    });
    $.export('$summary', `Weekly edition ${result.data.completionReason}: ${result.data.resultId}`);
    return result.data;
  },
};

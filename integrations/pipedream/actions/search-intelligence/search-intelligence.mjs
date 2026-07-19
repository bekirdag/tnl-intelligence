import tnl from '../../tnl_intelligence.app.mjs';
import { appProp, clientFor, compact } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-search-intelligence',
  name: 'Search Intelligence',
  description: 'Search cited TNL intelligence with explicit time and cursor controls.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    query: { type: 'string', label: 'Query' },
    from: { propDefinition: [tnl, 'from'] },
    to: { propDefinition: [tnl, 'to'] },
    pageSize: { propDefinition: [tnl, 'pageSize'] },
    cursor: { type: 'string', label: 'Cursor', optional: true },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'search_intelligence',
      input: compact({ query: this.query, from: this.from, to: this.to, pageSize: this.pageSize, cursor: this.cursor }),
    });
    $.export('$summary', `Returned ${result.data.count} TNL intelligence items`);
    return result.data;
  },
};

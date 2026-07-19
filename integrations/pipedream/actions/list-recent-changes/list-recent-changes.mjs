import { appProp, clientFor, compact } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-list-recent-changes',
  name: 'List Recent Intelligence Changes',
  description: 'List published, revised, and retracted intelligence since a UTC timestamp.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    since: { type: 'string', label: 'Since (UTC)' },
    pageSize: { type: 'integer', label: 'Page Size', default: 25, min: 1, max: 100 },
    cursor: { type: 'string', label: 'Cursor', optional: true },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'list_recent_changes',
      input: compact({ since: this.since, pageSize: this.pageSize, cursor: this.cursor }),
    });
    $.export('$summary', `Returned ${result.data.count} TNL changes`);
    return result.data;
  },
};

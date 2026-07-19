import { appProp, clientFor } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-get-intelligence',
  name: 'Get Intelligence Item',
  description: 'Retrieve one TNL intelligence item by stable ID or slug.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    id: { type: 'string', label: 'TNL ID or Slug' },
    includeBody: { type: 'boolean', label: 'Include Body', default: false, optional: true },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'get_intelligence',
      input: { id: this.id, includeBody: this.includeBody },
    });
    $.export('$summary', `Retrieved TNL item ${result.data.id}`);
    return result.data;
  },
};

import { appProp, clientFor, compact } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-get-exposure',
  name: 'Get Entity or Asset Exposure',
  description: 'Retrieve cited TNL exposure stories for an entity, asset, or impact path.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    kind: { type: 'string', label: 'Kind', options: ['entity', 'asset', 'impact_path'], default: 'entity' },
    value: { type: 'string', label: 'Entity, Asset, or Impact Path' },
    from: { type: 'string', label: 'From (UTC)', optional: true },
    to: { type: 'string', label: 'To (UTC)', optional: true },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'get_exposure',
      input: compact({ kind: this.kind, value: this.value, from: this.from, to: this.to }),
    });
    $.export('$summary', `Returned ${result.data.count} exposure items`);
    return result.data;
  },
};

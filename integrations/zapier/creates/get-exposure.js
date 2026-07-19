const { clean, clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const result = await (await clientFor(z, bundle)).execute({
    operation: 'get_exposure',
    input: clean({ kind: bundle.inputData.kind, value: bundle.inputData.value, from: bundle.inputData.from, to: bundle.inputData.to }),
  });
  return result.data;
};

module.exports = {
  key: 'get_exposure',
  noun: 'Exposure',
  display: { label: 'Get TNL Exposure', description: 'Get cited entity, asset, or impact-path exposure.' },
  operation: {
    perform,
    inputFields: [
      { key: 'kind', label: 'Kind', choices: ['entity', 'asset', 'impact_path'], default: 'entity', required: true },
      { key: 'value', label: 'Value', required: true },
      { key: 'from', label: 'From (UTC)', required: false },
      { key: 'to', label: 'To (UTC)', required: false },
    ],
    sample: { items: [], nextCursor: null, asOf: '2026-07-18T12:00:00.000Z', count: 0 },
  },
};

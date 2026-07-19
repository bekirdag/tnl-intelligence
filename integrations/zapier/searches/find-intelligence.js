const { clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const client = await clientFor(z, bundle);
  const result = await client.execute({
    operation: 'get_intelligence',
    input: {
      id: bundle.inputData.identifier,
      includeBody: bundle.inputData.include_body === true || bundle.inputData.include_body === 'true',
    },
  });
  return [result.data];
};

module.exports = {
  key: 'find_intelligence',
  noun: 'Intelligence Item',
  display: { label: 'Find TNL Intelligence Item', description: 'Find one TNL item by stable ID or slug.' },
  operation: {
    perform,
    inputFields: [
      { key: 'identifier', label: 'TNL ID or Slug', required: true },
      { key: 'include_body', label: 'Include Body', type: 'boolean', default: 'false', required: false },
    ],
    sample: { id: 'story_sample', revision: 1, title: 'Sample TNL intelligence', canonicalUrl: 'https://theneuralledger.com/news/sample' },
  },
};

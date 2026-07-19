const { clean, clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const client = await clientFor(z, bundle);
  const result = await client.execute({
    operation: 'search_intelligence',
    input: clean({
      query: bundle.inputData.query,
      from: bundle.inputData.from,
      to: bundle.inputData.to,
      category: bundle.inputData.category,
      geography: bundle.inputData.geography,
      pageSize: bundle.inputData.page_size,
      cursor: bundle.inputData.cursor,
    }),
  });
  return result.data;
};

module.exports = {
  key: 'search_intelligence',
  noun: 'Intelligence Search',
  display: { label: 'Search TNL Intelligence', description: 'Search cited TNL intelligence with time and cursor controls.' },
  operation: {
    perform,
    inputFields: [
      { key: 'query', label: 'Query', required: true },
      { key: 'from', label: 'From (UTC)', required: false },
      { key: 'to', label: 'To (UTC)', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'geography', label: 'Geography', required: false },
      { key: 'page_size', label: 'Page Size', type: 'integer', default: '25', required: false },
      { key: 'cursor', label: 'Cursor', required: false },
    ],
    sample: { items: [], nextCursor: null, asOf: '2026-07-18T12:00:00.000Z', count: 0 },
  },
};

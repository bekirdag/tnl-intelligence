const { clean, clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const result = await (await clientFor(z, bundle)).execute({
    operation: 'list_recent_changes',
    input: clean({
      since: bundle.inputData.since,
      pageSize: bundle.inputData.page_size,
      cursor: bundle.inputData.cursor,
      category: bundle.inputData.category,
      geography: bundle.inputData.geography,
    }),
  });
  return result.data;
};

module.exports = {
  key: 'list_recent_changes',
  noun: 'Intelligence Changes',
  display: {
    label: 'List Recent TNL Changes',
    description: 'List published, revised, and retracted intelligence since a UTC timestamp.',
  },
  operation: {
    perform,
    inputFields: [
      { key: 'since', label: 'Since (UTC)', required: true },
      { key: 'page_size', label: 'Page Size', type: 'integer', default: '25', required: false },
      { key: 'cursor', label: 'Cursor', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'geography', label: 'Geography', required: false },
    ],
    sample: { items: [], nextCursor: null, asOf: '2026-07-18T12:00:00.000Z', count: 0 },
  },
};

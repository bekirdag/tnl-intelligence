const { clean, clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const result = await (await clientFor(z, bundle)).execute({
    operation: 'get_weekly_edition',
    input: clean({ weekEnding: bundle.inputData.week_ending, category: bundle.inputData.category, geography: bundle.inputData.geography }),
  });
  return result.data;
};

module.exports = {
  key: 'get_weekly_edition',
  noun: 'Weekly Edition',
  display: { label: 'Get TNL Weekly Edition', description: 'Generate a cited consequential-development edition.' },
  operation: {
    perform,
    inputFields: [
      { key: 'week_ending', label: 'Week Ending (UTC)', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'geography', label: 'Geography', required: false },
    ],
    sample: { resultId: 'result_weekly_sample', completionReason: 'complete', asOf: '2026-07-18T12:00:00.000Z', citations: [] },
  },
};

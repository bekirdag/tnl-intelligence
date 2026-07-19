const { clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const result = await (await clientFor(z, bundle)).execute({
    operation: 'get_research_result',
    input: { resultId: bundle.inputData.result_ref },
  });
  return result.data;
};

module.exports = {
  key: 'get_research_result',
  noun: 'Research Result',
  display: {
    label: 'Get TNL Research Result',
    description: 'Retrieve a previously started TNL Bot research result by stable result ID.',
  },
  operation: {
    perform,
    inputFields: [{ key: 'result_ref', label: 'Research Result ID', required: true }],
    sample: {
      resultId: 'result_sample',
      completionReason: 'complete',
      asOf: '2026-07-18T12:00:00.000Z',
      citations: [],
    },
  },
};

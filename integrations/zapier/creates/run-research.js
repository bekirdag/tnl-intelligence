const { clean, clientFor } = require('../lib/common');

const perform = async (z, bundle) => {
  const result = await (await clientFor(z, bundle)).execute({
    operation: 'run_research',
    input: clean({
      workflowId: bundle.inputData.workflow,
      question: bundle.inputData.question,
      from: bundle.inputData.from,
      to: bundle.inputData.to,
      depth: bundle.inputData.depth,
    }),
  });
  return result.data;
};

module.exports = {
  key: 'run_research',
  noun: 'Research Result',
  display: { label: 'Run TNL Research', description: 'Run evidence-first TNL Bot research with citations and an as-of boundary.' },
  operation: {
    perform,
    inputFields: [
      { key: 'workflow', label: 'Workflow', choices: ['what-changed', 'compare-sources', 'validate-event', 'asset-exposure', 'operational-risk', 'weekly-consequential'], default: 'what-changed', required: true },
      { key: 'question', label: 'Question', required: true },
      { key: 'from', label: 'From (UTC)', required: false },
      { key: 'to', label: 'To (UTC)', required: false },
      { key: 'depth', label: 'Depth', choices: ['brief', 'standard', 'deep'], default: 'standard', required: true },
    ],
    sample: { resultId: 'result_sample', completionReason: 'complete', asOf: '2026-07-18T12:00:00.000Z', citations: [] },
  },
};

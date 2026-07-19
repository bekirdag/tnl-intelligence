import { appProp, clientFor, compact } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-run-research',
  name: 'Run TNL Research',
  description: 'Run an evidence-first TNL Bot research workflow with citations and an as-of boundary.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    workflowId: {
      type: 'string',
      label: 'Workflow',
      options: ['what-changed', 'compare-sources', 'validate-event', 'asset-exposure', 'operational-risk', 'weekly-consequential'],
      default: 'what-changed',
    },
    question: { type: 'string', label: 'Question' },
    from: { type: 'string', label: 'From (UTC)', optional: true },
    to: { type: 'string', label: 'To (UTC)', optional: true },
    depth: { type: 'string', label: 'Depth', options: ['brief', 'standard', 'deep'], default: 'standard' },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'run_research',
      input: compact({ workflowId: this.workflowId, question: this.question, from: this.from, to: this.to, depth: this.depth }),
    });
    $.export('$summary', `Research ${result.data.completionReason}: ${result.data.resultId}`);
    return result.data;
  },
};

import { appProp, clientFor } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-get-research-result',
  name: 'Get TNL Research Result',
  description: 'Retrieve a previously started TNL Bot research result by stable result ID.',
  version: '0.1.0',
  type: 'action',
  props: {
    tnl: appProp,
    resultId: { type: 'string', label: 'Research Result ID' },
  },
  async run({ $ }) {
    const result = await clientFor(this.tnl).execute({
      operation: 'get_research_result',
      input: { resultId: this.resultId },
    });
    $.export('$summary', `Retrieved research result ${result.data.resultId}`);
    return result.data;
  },
};

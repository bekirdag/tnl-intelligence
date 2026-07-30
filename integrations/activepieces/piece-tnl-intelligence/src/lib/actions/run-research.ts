import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const runResearch = createAction({
  auth: tnlIntelligenceAuth,
  name: 'run_research',
  displayName: 'Run Research',
  description: 'Run one of six evidence-backed TNL research workflows.',
  audience: 'both',
  aiMetadata: {
    description:
      'Runs a selected evidence-backed TNL research workflow and returns structured claims, confidence, verification state, and source links. Read-only and idempotent for the same inputs and evidence window.',
    idempotent: true,
  },
  props: {
    workflow: Property.StaticDropdown({
      displayName: 'Workflow',
      description: 'The bounded TNL research workflow to run.',
      required: true,
      options: {
        options: [
          { label: 'What Changed', value: 'what-changed' },
          { label: 'Compare Sources', value: 'compare-sources' },
          { label: 'Validate Event', value: 'validate-event' },
          { label: 'Asset Exposure', value: 'asset-exposure' },
          { label: 'Operational Risk', value: 'operational-risk' },
          { label: 'Weekly Consequential', value: 'weekly-consequential' },
        ],
      },
    }),
    question: Property.LongText({
      displayName: 'Question or Subject',
      description: 'The question, event, asset, or subject for the selected workflow.',
      required: true,
    }),
    from: Property.DateTime({
      displayName: 'From',
      description: 'Optional start of the research evidence window.',
      required: false,
    }),
    to: Property.DateTime({
      displayName: 'To',
      description: 'Optional end of the research evidence window.',
      required: false,
    }),
    limit: Property.Number({
      displayName: 'Evidence Limit',
      description: 'Maximum evidence records to consider, from 1 to 100.',
      required: false,
      defaultValue: 20,
    }),
  },
  async run({ auth, propsValue }) {
    return tnlClient.create({ apiKey: auth.secret_text }).runResearch({
      workflow: propsValue.workflow,
      question: propsValue.question,
      from: propsValue.from,
      to: propsValue.to,
      limit: propsValue.limit,
    });
  },
});

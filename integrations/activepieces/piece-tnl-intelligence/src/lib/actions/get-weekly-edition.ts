import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const getWeeklyEdition = createAction({
  auth: tnlIntelligenceAuth,
  name: 'get_weekly_edition',
  displayName: 'Get Weekly Edition',
  description: 'Generate an evidence-backed consequential weekly edition.',
  audience: 'both',
  aiMetadata: {
    description:
      'Generates a cited weekly summary of consequential developments with optional category or geography focus. Read-only and idempotent for the same week and filters.',
    idempotent: true,
  },
  props: {
    week_ending: Property.DateTime({
      displayName: 'Week Ending',
      description: 'Optional end of the seven-day edition window. Defaults to now.',
      required: false,
    }),
    category: Property.ShortText({
      displayName: 'Category',
      description: 'Optional category focus.',
      required: false,
    }),
    geography: Property.ShortText({
      displayName: 'Geography',
      description: 'Optional country or geography focus.',
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
    return tnlClient.create({ apiKey: auth.secret_text }).getWeeklyEdition({
      weekEnding: propsValue.week_ending,
      category: propsValue.category,
      geography: propsValue.geography,
      limit: propsValue.limit,
    });
  },
});

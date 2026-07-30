import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const searchIntelligence = createAction({
  auth: tnlIntelligenceAuth,
  name: 'search_intelligence',
  displayName: 'Search Intelligence',
  description: 'Search cited TNL intelligence records.',
  audience: 'both',
  aiMetadata: {
    description:
      'Searches cited TNL intelligence by query and returns structured records, source links, and pagination. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    query: Property.LongText({
      displayName: 'Query',
      description: 'The intelligence topic, event, organization, person, or asset to search.',
      required: true,
    }),
    page_size: Property.Number({
      displayName: 'Page Size',
      description: 'Number of records to return, from 1 to 100.',
      required: false,
      defaultValue: 20,
    }),
    cursor: Property.ShortText({
      displayName: 'Cursor',
      description: 'Pagination cursor returned by a previous call.',
      required: false,
    }),
    include_body: Property.Checkbox({
      displayName: 'Include Body',
      description: 'Include full record bodies when available.',
      required: false,
      defaultValue: false,
    }),
  },
  async run({ auth, propsValue }) {
    return tnlClient.create({ apiKey: auth.secret_text }).searchIntelligence({
      query: propsValue.query,
      pageSize: propsValue.page_size,
      cursor: propsValue.cursor,
      includeBody: propsValue.include_body,
    });
  },
});

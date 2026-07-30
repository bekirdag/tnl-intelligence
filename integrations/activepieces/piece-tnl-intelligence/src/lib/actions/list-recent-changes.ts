import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const listRecentChanges = createAction({
  auth: tnlIntelligenceAuth,
  name: 'list_recent_changes',
  displayName: 'List Recent Changes',
  description: 'List TNL records created or revised after a timestamp.',
  audience: 'both',
  aiMetadata: {
    description:
      'Lists intelligence records changed since an ISO timestamp, including revisions, evidence, and pagination. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    since: Property.DateTime({
      displayName: 'Changed Since',
      description: 'Return records changed after this date and time.',
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
  },
  async run({ auth, propsValue }) {
    return tnlClient.create({ apiKey: auth.secret_text }).listRecentChanges({
      since: propsValue.since,
      pageSize: propsValue.page_size,
      cursor: propsValue.cursor,
    });
  },
});

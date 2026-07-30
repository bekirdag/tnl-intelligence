import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const getIntelligence = createAction({
  auth: tnlIntelligenceAuth,
  name: 'get_intelligence',
  displayName: 'Get Intelligence',
  description: 'Retrieve one cited TNL intelligence record by ID or slug.',
  audience: 'both',
  aiMetadata: {
    description:
      'Retrieves one TNL intelligence record with its revision, claims, evidence, and source links. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    id: Property.ShortText({
      displayName: 'Record ID or Slug',
      description: 'The stable TNL record ID or slug.',
      required: true,
    }),
    include_body: Property.Checkbox({
      displayName: 'Include Body',
      description: 'Include the full record body when available.',
      required: false,
      defaultValue: false,
    }),
  },
  async run({ auth, propsValue }) {
    return tnlClient.create({ apiKey: auth.secret_text }).getIntelligence({
      id: propsValue.id,
      includeBody: propsValue.include_body,
    });
  },
});

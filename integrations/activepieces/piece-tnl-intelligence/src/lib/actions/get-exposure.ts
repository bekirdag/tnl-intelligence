import { createAction, Property } from '@activepieces/pieces-framework';
import { tnlIntelligenceAuth } from '../auth';
import { tnlClient } from '../client';

export const getExposure = createAction({
  auth: tnlIntelligenceAuth,
  name: 'get_exposure',
  displayName: 'Get Exposure',
  description: 'Find intelligence linked to an entity, asset, or impact path.',
  audience: 'both',
  aiMetadata: {
    description:
      'Finds cited TNL intelligence records linked to an entity, asset, or impact path. Read-only and idempotent.',
    idempotent: true,
  },
  props: {
    kind: Property.StaticDropdown({
      displayName: 'Exposure Type',
      description: 'The type of exposure value to resolve.',
      required: true,
      options: {
        options: [
          { label: 'Entity', value: 'entity' },
          { label: 'Asset', value: 'asset' },
          { label: 'Impact Path', value: 'impact_path' },
        ],
      },
    }),
    value: Property.ShortText({
      displayName: 'Exposure Value',
      description: 'Entity name or ID, asset ticker, or impact-path value.',
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
    return tnlClient.create({ apiKey: auth.secret_text }).getExposure({
      kind: propsValue.kind,
      value: propsValue.value,
      pageSize: propsValue.page_size,
      cursor: propsValue.cursor,
    });
  },
});

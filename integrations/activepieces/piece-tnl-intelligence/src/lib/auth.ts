import { PieceAuth } from '@activepieces/pieces-framework';
import { tnlClient } from './client';

export const tnlIntelligenceAuth = PieceAuth.SecretText({
  displayName: 'TNL API Key',
  description:
    'Create an API key at https://theneuralledger.com/member. Read actions require tnl:read and research actions require tnl:research.',
  required: true,
  validate: async ({ auth }) => {
    try {
      await tnlClient.create({ apiKey: auth }).validateCredentials();
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'The TNL API key is invalid or does not have read access.',
      };
    }
  },
});

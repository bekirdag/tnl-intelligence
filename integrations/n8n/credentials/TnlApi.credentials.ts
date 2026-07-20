import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class TnlApi implements ICredentialType {
  name = 'tnlApi';
  displayName = 'TNL Intelligence API';
  icon = 'file:../icons/tnl-bot.svg' as const;
  documentationUrl = 'https://github.com/bekirdag/tnl-intelligence';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'API URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://theneuralledger.com',
      required: true,
    },
    {
      displayName: 'Research URL',
      name: 'researchUrl',
      type: 'string',
      default: 'https://research.theneuralledger.com',
      required: true,
    },
    {
      displayName: 'Webhook Control URL',
      name: 'webhookUrl',
      type: 'string',
      default: 'https://hooks.theneuralledger.com',
      required: true,
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/v1/me',
      method: 'GET',
    },
  };
}

const test = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.api_url || 'https://theneuralledger.com'}/v1/me`,
    headers: { authorization: `Bearer ${bundle.authData.api_key}` },
  });
  response.throwForStatus();
  return response.data;
};

module.exports = {
  type: 'custom',
  test,
  connectionLabel: 'TNL Intelligence {{key.name}}',
  fields: [
    {
      key: 'api_key',
      label: 'TNL API Key',
      type: 'string',
      required: true,
      helpText: 'Use a TNL API key as described in the [TNL client documentation](https://github.com/bekirdag/tnl-intelligence#authentication).',
    },
    {
      key: 'webhook_secret',
      label: 'Webhook Verification Secret',
      type: 'password',
      required: true,
      helpText: 'Create a base64url secret with 32-64 decoded bytes using the [webhook operations guide](https://github.com/bekirdag/tnl-intelligence/blob/main/docs/webhook-operations.md). Zapier stores it only in this connection.',
    },
  ],
};

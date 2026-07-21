const test = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.api_url || 'https://theneuralledger.com'}/v1/me`,
    headers: { authorization: `Bearer ${bundle.authData.api_key}` },
  });
  response.throwForStatus();
  const account = response.data && typeof response.data === 'object' ? response.data : {};
  return {
    ...account,
    connection_name: account.email || account.username || account.name || account.id || 'Account',
  };
};

module.exports = {
  type: 'custom',
  test,
  connectionLabel: 'TNL Intelligence {{connection_name}}',
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

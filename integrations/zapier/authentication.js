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
  connectionLabel: '{{connection_name}}',
  fields: [
    {
      key: 'api_key',
      label: 'TNL API Key',
      type: 'password',
      required: true,
      helpText: 'Use an API key as described in [The Neural Ledger authentication guide](https://developers.theneuralledger.com/guides/authentication).',
    },
    {
      key: 'webhook_secret',
      label: 'Webhook Verification Secret',
      type: 'password',
      required: true,
      helpText: 'Create a base64url secret with 32-64 decoded bytes using [The Neural Ledger webhook verification guide](https://developers.theneuralledger.com/webhooks/verifying). Zapier stores it only in this connection.',
    },
  ],
};

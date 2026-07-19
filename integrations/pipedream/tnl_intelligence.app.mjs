export default {
  type: 'app',
  app: 'tnl_intelligence',
  propDefinitions: {
    from: { type: 'string', label: 'From (UTC)', optional: true },
    to: { type: 'string', label: 'To (UTC)', optional: true },
    pageSize: { type: 'integer', label: 'Page Size', default: 25, min: 1, max: 100 },
  },
  methods: {
    connection() {
      const auth = this.$auth ?? {};
      return {
        apiKey: auth.api_key,
        baseUrl: auth.api_url || 'https://theneuralledger.com',
        researchUrl: auth.research_url || 'https://research.theneuralledger.com',
        webhookUrl: auth.webhook_url || 'https://hooks.theneuralledger.com',
      };
    },
  },
};

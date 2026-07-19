const { createSubscription, deleteSubscription, processWebhook } = require('../lib/common');

const subscribe = async (z, bundle) => {
  const subscription = await createSubscription(z, bundle, {
    endpoint: bundle.targetUrl,
    eventTypes: bundle.inputData.event_types,
    secret: bundle.authData.webhook_secret,
    filters: {
      ...(bundle.inputData.category ? { categories: [bundle.inputData.category] } : {}),
      ...(bundle.inputData.minimum_confidence !== undefined
        ? { minimumConfidence: bundle.inputData.minimum_confidence }
        : {}),
    },
  });
  return { id: subscription.id };
};

const unsubscribe = async (z, bundle) => {
  await deleteSubscription(z, bundle, bundle.subscribeData.id);
  return {};
};

const perform = async (_z, bundle) => {
  const headers = bundle.rawRequest.headers;
  const result = processWebhook({
    rawBody: bundle.rawRequest.content,
    headers,
    secret: bundle.authData.webhook_secret,
  });
  return [result];
};

const performList = async () => [sample];

const sample = {
  id: 'evt_sample123456789:1',
  deliveryId: 'dlv_sample123456789',
  type: 'intelligence.published',
  occurredAt: '2026-07-18T08:00:00.000Z',
  publishedAt: '2026-07-18T08:01:00.000Z',
  resourceId: 'story_sample',
  revision: 1,
  canonicalUrl: 'https://theneuralledger.com/news/sample',
  summary: 'Synthetic TNL intelligence event for Zap setup.',
  categories: ['technology'],
  geographies: ['US'],
  entities: ['Example Corp'],
  assets: ['EXMPL'],
  impactPaths: ['supply-chain'],
  confidence: 0.9,
  envelope: {
    id: 'evt_sample123456789',
    type: 'intelligence.published',
    schemaVersion: '1.0',
    occurredAt: '2026-07-18T08:00:00.000Z',
    publishedAt: '2026-07-18T08:01:00.000Z',
    tenantId: 'sample-tenant',
    resource: { id: 'story_sample', revision: 1, url: 'https://theneuralledger.com/news/sample' },
    data: {
      summary: 'Synthetic TNL intelligence event for Zap setup.',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Corp'],
      assets: ['EXMPL'],
      impactPaths: ['supply-chain'],
      confidence: 0.9,
      language: 'en',
      provenance: ['https://example.com/synthetic-source'],
    },
    metadata: { producer: 'tnl', traceId: 'sample-trace-123' },
  },
};

module.exports = {
  key: 'new_or_updated_intelligence',
  noun: 'Intelligence Event',
  display: {
    label: 'New or Updated TNL Intelligence',
    description: 'Triggers when TNL publishes a signed publication, revision, retraction, impact change, or weekly edition.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribe,
    performUnsubscribe: unsubscribe,
    perform,
    performList,
    inputFields: [
      {
        key: 'event_types',
        label: 'Event Types',
        list: true,
        choices: [
          'intelligence.published',
          'intelligence.updated',
          'intelligence.retracted',
          'intelligence.impact_changed',
          'digest.weekly_published',
        ],
        default: 'intelligence.published,intelligence.updated',
        required: true,
      },
      { key: 'category', label: 'Category', required: false },
      { key: 'minimum_confidence', label: 'Minimum Confidence', type: 'number', required: false },
    ],
    sample,
    outputFields: [
      { key: 'id', label: 'Event Revision ID' },
      { key: 'deliveryId', label: 'Delivery ID' },
      { key: 'type', label: 'Event Type' },
      { key: 'occurredAt', label: 'Occurred At', type: 'datetime' },
      { key: 'publishedAt', label: 'Published At', type: 'datetime' },
      { key: 'resourceId', label: 'Resource ID' },
      { key: 'revision', label: 'Revision', type: 'integer' },
      { key: 'canonicalUrl', label: 'Canonical URL' },
      { key: 'summary', label: 'Summary' },
      { key: 'categories', label: 'Categories', list: true },
      { key: 'geographies', label: 'Geographies', list: true },
      { key: 'entities', label: 'Entities', list: true },
      { key: 'assets', label: 'Assets', list: true },
      { key: 'impactPaths', label: 'Impact Paths', list: true },
      { key: 'confidence', label: 'Confidence', type: 'number' },
    ],
  },
};

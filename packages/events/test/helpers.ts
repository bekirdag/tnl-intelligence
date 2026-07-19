import {
  createWebhookEvent,
  type EndpointResolver,
  type SubscriptionActor,
  type WebhookEventEnvelope,
} from '../src/index.js';

export function fixture(overrides: Partial<WebhookEventEnvelope> = {}): WebhookEventEnvelope {
  return createWebhookEvent({
    id: 'evt_fixture123456789',
    type: 'intelligence.published',
    tenantId: 'tenant-1',
    occurredAt: '2026-07-18T12:00:00.000Z',
    publishedAt: '2026-07-18T12:00:02.000Z',
    traceId: 'trace-fixture-1',
    resource: {
      id: 'story-1',
      revision: 1,
      url: 'https://theneuralledger.com/story-1',
    },
    data: {
      summary: 'A synthetic event summary.',
      categories: ['Technology'],
      geographies: ['United States'],
      entities: ['Example Semiconductor'],
      assets: ['EXM'],
      impactPaths: ['supply-chain'],
      confidence: 0.82,
      language: 'en',
      provenance: ['https://example.com/source'],
    },
    ...overrides,
  });
}

export function resolver(...addresses: string[]): EndpointResolver {
  return { resolve: async () => addresses };
}

export function actor(values: Partial<SubscriptionActor> = {}): SubscriptionActor {
  return { ownerId: 'user-1', tenantId: 'tenant-1', ...values };
}

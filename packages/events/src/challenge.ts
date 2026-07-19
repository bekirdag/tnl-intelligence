import { createHash } from 'node:crypto';
import { createWebhookEvent } from './contracts.js';
import { signWebhook } from './signing.js';
import {
  SubscriptionError,
  type SubscriptionActor,
  type SubscriptionService,
} from './subscriptions.js';
import type { DeliveryTransport } from './transport.js';

export class WebhookChallengeService {
  constructor(
    readonly subscriptions: SubscriptionService,
    readonly transport: DeliveryTransport,
    readonly now: () => number = Date.now,
  ) {}

  async verify(actor: SubscriptionActor, subscriptionId: string): Promise<void> {
    const material = await this.subscriptions.challengeMaterial(actor, subscriptionId);
    const now = this.now();
    const event = createWebhookEvent({
      id: `evt_${createHash('sha256').update(`${subscriptionId}\u0000${now}`).digest('base64url').slice(0, 24)}`,
      type: 'subscription.test',
      tenantId: actor.tenantId,
      occurredAt: new Date(now).toISOString(),
      publishedAt: new Date(now).toISOString(),
      traceId: `challenge-${subscriptionId}`.slice(0, 120),
      resource: {
        id: subscriptionId,
        revision: 1,
        url: 'https://theneuralledger.com/developers/webhooks',
      },
      data: {
        summary: 'TNL webhook endpoint verification.',
        categories: [],
        geographies: [],
        entities: [],
        assets: [],
        impactPaths: [],
        provenance: ['https://theneuralledger.com/developers/webhooks'],
      },
    });
    const rawBody = Buffer.from(JSON.stringify(event));
    const deliveryId = `dlv_${createHash('sha256').update(event.id).digest('base64url').slice(0, 24)}`;
    const signed = signWebhook({
      event,
      rawBody,
      deliveryId,
      keyId: material.keyId,
      secret: material.secret,
      timestamp: Math.floor(now / 1_000),
      attemptId: `att_${createHash('sha256').update(deliveryId).digest('base64url').slice(0, 24)}`,
    });
    const headers = Object.fromEntries(
      Object.entries(signed).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    const response = await this.transport.send({
      endpoint: material.endpoint,
      rawBody,
      headers,
      timeoutMs: 10_000,
    });
    if (response.status < 200 || response.status > 299)
      throw new SubscriptionError('challenge_failed', 409);
    await this.subscriptions.activate(actor, subscriptionId);
  }
}

import {
  VerificationError,
  verifyWebhook,
  validateWebhookEvent,
  type ReplayStore,
  type WebhookEventEnvelope,
} from '@theneuralledger/events';
import type { ConnectorTriggerOutput } from './contracts.js';
import { ConnectorError } from './errors.js';

export interface ConnectorDedupeStore {
  claim(id: string, expiresAt: number): boolean | Promise<boolean>;
}

export class MemoryConnectorDedupeStore implements ConnectorDedupeStore {
  readonly #values = new Map<string, number>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  claim(id: string, expiresAt: number): boolean {
    const now = this.#now();
    for (const [key, expiry] of this.#values) if (expiry <= now) this.#values.delete(key);
    if (this.#values.has(id)) return false;
    this.#values.set(id, expiresAt);
    return true;
  }
}

export async function processConnectorWebhook(options: {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  secret: string | Buffer;
  keyId: string;
  replayStore?: ReplayStore;
  eventDedupeStore?: ConnectorDedupeStore;
  now?: number;
  toleranceSeconds?: number;
}): Promise<ConnectorTriggerOutput> {
  try {
    const verified = await verifyWebhook({
      rawBody: options.rawBody,
      headers: options.headers,
      keys: { [options.keyId]: webhookSecret(options.secret) },
      ...(options.replayStore ? { replayStore: options.replayStore } : {}),
      ...(options.now ? { now: options.now } : {}),
      ...(options.toleranceSeconds ? { toleranceSeconds: options.toleranceSeconds } : {}),
    });
    const parsed = JSON.parse(
      Buffer.isBuffer(options.rawBody) ? options.rawBody.toString('utf8') : options.rawBody,
    ) as unknown;
    const problems = validateWebhookEvent(parsed);
    if (problems.length)
      throw new ConnectorError('invalid_webhook', 'The webhook event contract is invalid.', false);
    const envelope = parsed as WebhookEventEnvelope;
    const eventClaim = `${envelope.id}:${envelope.resource.revision}`;
    if (options.eventDedupeStore) {
      const accepted = await options.eventDedupeStore.claim(
        eventClaim,
        Date.parse(envelope.publishedAt) + 7 * 86_400_000,
      );
      if (!accepted)
        throw new ConnectorError(
          'duplicate_event',
          'The webhook event was already processed.',
          false,
        );
    }
    return {
      id: eventClaim,
      deliveryId: verified.deliveryId,
      type: envelope.type,
      occurredAt: envelope.occurredAt,
      publishedAt: envelope.publishedAt,
      resourceId: envelope.resource.id,
      revision: envelope.resource.revision,
      canonicalUrl: envelope.resource.url,
      summary: envelope.data.summary,
      categories: [...envelope.data.categories],
      geographies: [...envelope.data.geographies],
      entities: [...envelope.data.entities],
      assets: [...envelope.data.assets],
      impactPaths: [...envelope.data.impactPaths],
      confidence: envelope.data.confidence ?? null,
      envelope,
    };
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    if (error instanceof VerificationError) {
      if (error.code === 'duplicate_delivery')
        throw new ConnectorError(
          'duplicate_event',
          'The webhook delivery was already processed.',
          false,
        );
      throw new ConnectorError(
        'invalid_webhook',
        'The webhook signature or timestamp is invalid.',
        false,
      );
    }
    throw new ConnectorError('invalid_webhook', 'The webhook payload is invalid.', false);
  }
}

function webhookSecret(value: string | Buffer): string | Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (!/^[A-Za-z0-9_-]{43,86}$/.test(value)) return value;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.length >= 32 && decoded.length <= 64 && decoded.toString('base64url') === value
    ? decoded
    : value;
}

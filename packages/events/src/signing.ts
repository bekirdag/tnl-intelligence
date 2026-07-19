import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookEventEnvelope } from './generated/events.js';

export interface WebhookSignatureHeaders {
  'TNL-Webhook-Id': string;
  'TNL-Webhook-Timestamp': string;
  'TNL-Webhook-Key-Id': string;
  'TNL-Webhook-Signature': string;
  'TNL-Event-Type': string;
  'TNL-Event-Version': string;
  'TNL-Webhook-Attempt-Id'?: string;
}

export interface ReplayStore {
  claim(deliveryId: string, expiresAt: number): boolean | Promise<boolean>;
}

export class InMemoryReplayStore implements ReplayStore {
  readonly #claims = new Map<string, number>();

  claim(deliveryId: string, expiresAt: number): boolean {
    const now = Date.now();
    for (const [id, expiry] of this.#claims) if (expiry <= now) this.#claims.delete(id);
    if (this.#claims.has(deliveryId)) return false;
    this.#claims.set(deliveryId, expiresAt);
    return true;
  }
}

export function signWebhook(options: {
  event: WebhookEventEnvelope;
  rawBody: string | Buffer;
  deliveryId: string;
  keyId: string;
  secret: string | Buffer;
  timestamp?: number;
  attemptId?: string;
}): WebhookSignatureHeaders {
  requireSecret(options.secret);
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1_000);
  if (!Number.isInteger(timestamp) || timestamp < 1)
    throw new Error('timestamp must be Unix seconds');
  if (!/^dlv_[A-Za-z0-9_-]{12,100}$/.test(options.deliveryId))
    throw new Error('deliveryId is invalid');
  if (!/^key_[A-Za-z0-9_-]{8,100}$/.test(options.keyId)) throw new Error('keyId is invalid');
  const digest = signature(options.secret, timestamp, options.deliveryId, options.rawBody);
  return {
    'TNL-Webhook-Id': options.deliveryId,
    'TNL-Webhook-Timestamp': String(timestamp),
    'TNL-Webhook-Key-Id': options.keyId,
    'TNL-Webhook-Signature': `v1=${digest}`,
    'TNL-Event-Type': options.event.type,
    'TNL-Event-Version': options.event.schemaVersion,
    ...(options.attemptId ? { 'TNL-Webhook-Attempt-Id': options.attemptId } : {}),
  };
}

export async function verifyWebhook(options: {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  keys: Readonly<Record<string, string | Buffer>>;
  replayStore?: ReplayStore;
  now?: number;
  toleranceSeconds?: number;
}): Promise<{ deliveryId: string; keyId: string; timestamp: number }> {
  const deliveryId = header(options.headers, 'tnl-webhook-id');
  const keyId = header(options.headers, 'tnl-webhook-key-id');
  const timestampText = header(options.headers, 'tnl-webhook-timestamp');
  const supplied = header(options.headers, 'tnl-webhook-signature');
  if (!/^dlv_[A-Za-z0-9_-]{12,100}$/.test(deliveryId)) throw new VerificationError('invalid_id');
  if (!/^key_[A-Za-z0-9_-]{8,100}$/.test(keyId)) throw new VerificationError('unknown_key');
  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp)) throw new VerificationError('invalid_timestamp');
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  const tolerance = options.toleranceSeconds ?? 300;
  if (tolerance < 1 || tolerance > 86_400) throw new Error('toleranceSeconds is out of range');
  if (Math.abs(now - timestamp) > tolerance) throw new VerificationError('stale_timestamp');
  const secret = options.keys[keyId];
  if (!secret) throw new VerificationError('unknown_key');
  requireSecret(secret);
  const match = supplied.match(/^v1=([a-f0-9]{64})$/);
  if (!match) throw new VerificationError('invalid_signature');
  const expected = Buffer.from(signature(secret, timestamp, deliveryId, options.rawBody), 'hex');
  const actual = Buffer.from(match[1] as string, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new VerificationError('invalid_signature');
  if (options.replayStore) {
    const accepted = await options.replayStore.claim(deliveryId, (timestamp + tolerance) * 1_000);
    if (!accepted) throw new VerificationError('duplicate_delivery');
  }
  return { deliveryId, keyId, timestamp };
}

export class VerificationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'VerificationError';
  }
}

function signature(
  secret: string | Buffer,
  timestamp: number,
  deliveryId: string,
  rawBody: string | Buffer,
): string {
  const prefix = Buffer.from(`v1.${timestamp}.${deliveryId}.`, 'utf8');
  return createHmac('sha256', secret).update(prefix).update(rawBody).digest('hex');
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) continue;
    if (typeof value === 'string' && value.length <= 500) return value;
    break;
  }
  throw new VerificationError('missing_header');
}

function requireSecret(secret: string | Buffer): void {
  if (Buffer.byteLength(secret) < 32) throw new Error('webhook secret must be at least 32 bytes');
}

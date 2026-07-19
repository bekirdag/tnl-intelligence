import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { NullWebhookAuditSink, type WebhookAuditAction, type WebhookAuditSink } from './audit.js';
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookEventEnvelope,
  type WebhookEventType,
} from './generated/events.js';
import { validateEndpoint, type EndpointPolicy, type EndpointResolver } from './endpoint.js';
import { matchesSubscription, normalizeFilters, type SubscriptionFilters } from './filters.js';

export type SubscriptionState = 'pending' | 'active' | 'paused' | 'disabled' | 'deleted';

export interface SubscriptionActor {
  ownerId: string;
  tenantId: string;
  canReplay?: boolean;
}

interface ProtectedKey {
  id: string;
  ciphertext: string;
  expiresAt?: string;
}

export interface SubscriptionRecord {
  id: string;
  ownerId: string;
  tenantId: string;
  endpoint: string;
  eventTypes: readonly WebhookEventType[];
  filters: SubscriptionFilters;
  state: SubscriptionState;
  activeKey: ProtectedKey;
  previousKeys: readonly ProtectedKey[];
  createdAt: string;
  verifiedAt?: string;
  lastDeliveryAt?: string;
  pausedReason?: string;
  deletedAt?: string;
}

export interface SubscriptionMetadata
  extends Omit<SubscriptionRecord, 'activeKey' | 'previousKeys'> {
  activeKeyId?: string;
  previousKeyIds: readonly string[];
}

export interface IssuedSubscription {
  secret: string;
  subscription: SubscriptionMetadata;
}

export interface SubscriptionStore {
  save(record: SubscriptionRecord): Promise<void>;
  get(id: string): Promise<SubscriptionRecord | undefined>;
  list(ownerId?: string, tenantId?: string): Promise<SubscriptionRecord[]>;
}

export interface SecretProtector {
  encrypt(value: Buffer): string;
  decrypt(value: string): Buffer;
}

export class AesGcmSecretProtector implements SecretProtector {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error('secret protector key must be 32 bytes');
    this.#key = Buffer.from(key);
  }

  encrypt(value: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#key, iv);
    const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): Buffer {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('protected secret is malformed');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.#key,
      Buffer.from(parts[0] as string, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(parts[1] as string, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2] as string, 'base64url')),
      decipher.final(),
    ]);
  }
}

export class InMemorySubscriptionStore implements SubscriptionStore {
  readonly records = new Map<string, SubscriptionRecord>();

  async save(record: SubscriptionRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async get(id: string): Promise<SubscriptionRecord | undefined> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  async list(ownerId?: string, tenantId?: string): Promise<SubscriptionRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          (ownerId === undefined || record.ownerId === ownerId) &&
          (tenantId === undefined || record.tenantId === tenantId),
      )
      .map((record) => structuredClone(record));
  }
}

export class SubscriptionService {
  readonly #store: SubscriptionStore;
  readonly #protector: SecretProtector;
  readonly #resolver: EndpointResolver;
  readonly #endpointPolicy: EndpointPolicy;
  readonly #now: () => number;
  readonly #audit: WebhookAuditSink;

  constructor(options: {
    store: SubscriptionStore;
    protector: SecretProtector;
    resolver: EndpointResolver;
    endpointPolicy?: EndpointPolicy;
    now?: () => number;
    audit?: WebhookAuditSink;
  }) {
    this.#store = options.store;
    this.#protector = options.protector;
    this.#resolver = options.resolver;
    this.#endpointPolicy = options.endpointPolicy ?? {};
    this.#now = options.now ?? Date.now;
    this.#audit = options.audit ?? new NullWebhookAuditSink();
  }

  async create(
    actor: SubscriptionActor,
    input: {
      endpoint: string;
      eventTypes: readonly WebhookEventType[];
      filters?: SubscriptionFilters;
      secret?: string;
    },
  ): Promise<IssuedSubscription> {
    const endpoint = await validateEndpoint(input.endpoint, this.#resolver, this.#endpointPolicy);
    const eventTypes = [...new Set(input.eventTypes)];
    if (
      eventTypes.length === 0 ||
      eventTypes.length > WEBHOOK_EVENT_TYPES.length ||
      eventTypes.some((type) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(type))
    )
      throw new SubscriptionError('invalid_event_types', 400);
    const secret = input.secret ? suppliedSecret(input.secret) : randomBytes(32);
    const record: SubscriptionRecord = {
      id: `sub_${randomUUID().replaceAll('-', '')}`,
      ownerId: actor.ownerId,
      tenantId: actor.tenantId,
      endpoint: endpoint.url,
      eventTypes,
      filters: normalizeFilters(input.filters),
      state: 'pending',
      activeKey: {
        id: `key_${randomBytes(10).toString('base64url')}`,
        ciphertext: this.#protector.encrypt(secret),
      },
      previousKeys: [],
      createdAt: new Date(this.#now()).toISOString(),
    };
    await this.#store.save(record);
    await this.emit('subscription_created', actor, record.id, 'user_created');
    return { secret: secret.toString('base64url'), subscription: metadata(record) };
  }

  async list(actor: SubscriptionActor): Promise<SubscriptionMetadata[]> {
    return (await this.#store.list(actor.ownerId, actor.tenantId)).map(metadata);
  }

  async inspect(actor: SubscriptionActor, id: string): Promise<SubscriptionMetadata> {
    return metadata(await owned(this.#store, actor, id));
  }

  async challengeMaterial(
    actor: SubscriptionActor,
    id: string,
  ): Promise<{ endpoint: string; keyId: string; secret: Buffer }> {
    const record = await owned(this.#store, actor, id);
    if (record.state !== 'pending') throw new SubscriptionError('invalid_state', 409);
    return {
      endpoint: record.endpoint,
      keyId: record.activeKey.id,
      secret: this.#protector.decrypt(record.activeKey.ciphertext),
    };
  }

  async activate(actor: SubscriptionActor, id: string): Promise<SubscriptionMetadata> {
    const record = await owned(this.#store, actor, id);
    if (record.state !== 'pending' && record.state !== 'paused')
      throw new SubscriptionError('invalid_state', 409);
    record.state = 'active';
    record.verifiedAt = new Date(this.#now()).toISOString();
    delete record.pausedReason;
    await this.#store.save(record);
    await this.emit('subscription_activated', actor, id, 'challenge_succeeded');
    return metadata(record);
  }

  async pause(
    actor: SubscriptionActor,
    id: string,
    reason = 'user_paused',
  ): Promise<SubscriptionMetadata> {
    const record = await owned(this.#store, actor, id);
    if (record.state === 'deleted') throw new SubscriptionError('not_found', 404);
    record.state = 'paused';
    record.pausedReason = boundedReason(reason);
    await this.#store.save(record);
    await this.emit('subscription_paused', actor, id, record.pausedReason);
    return metadata(record);
  }

  async disable(id: string, reason: string): Promise<void> {
    const record = await this.#store.get(id);
    if (!record || record.state === 'deleted') return;
    record.state = 'disabled';
    record.pausedReason = boundedReason(reason);
    await this.#store.save(record);
    await this.emit(
      'subscription_disabled',
      { ownerId: record.ownerId, tenantId: record.tenantId },
      id,
      record.pausedReason,
    );
  }

  async rotate(
    actor: SubscriptionActor,
    id: string,
    overlapSeconds = 86_400,
  ): Promise<IssuedSubscription> {
    if (!Number.isInteger(overlapSeconds) || overlapSeconds < 0 || overlapSeconds > 604_800)
      throw new SubscriptionError('invalid_overlap', 400);
    const record = await owned(this.#store, actor, id);
    if (record.state === 'deleted') throw new SubscriptionError('not_found', 404);
    const now = this.#now();
    const secret = randomBytes(32);
    record.previousKeys = [
      { ...record.activeKey, expiresAt: new Date(now + overlapSeconds * 1_000).toISOString() },
    ];
    record.activeKey = {
      id: `key_${randomBytes(10).toString('base64url')}`,
      ciphertext: this.#protector.encrypt(secret),
    };
    await this.#store.save(record);
    await this.emit('subscription_rotated', actor, id, 'user_rotated');
    return { secret: secret.toString('base64url'), subscription: metadata(record) };
  }

  async delete(actor: SubscriptionActor, id: string): Promise<void> {
    const record = await owned(this.#store, actor, id);
    record.state = 'deleted';
    record.deletedAt = new Date(this.#now()).toISOString();
    record.activeKey = { id: record.activeKey.id, ciphertext: '' };
    record.previousKeys = [];
    await this.#store.save(record);
    await this.emit('subscription_deleted', actor, id, 'user_deleted');
  }

  async matching(event: WebhookEventEnvelope): Promise<SubscriptionRecord[]> {
    return (await this.#store.list(undefined, event.tenantId)).filter(
      (record) =>
        record.state === 'active' && matchesSubscription(event, record.eventTypes, record.filters),
    );
  }

  async signingKeys(
    subscriptionId: string,
  ): Promise<{ active: { id: string; secret: Buffer }; verify: Record<string, Buffer> }> {
    const record = await this.#store.get(subscriptionId);
    if (!record || record.state !== 'active') throw new SubscriptionError('not_active', 409);
    const now = this.#now();
    const active = {
      id: record.activeKey.id,
      secret: this.#protector.decrypt(record.activeKey.ciphertext),
    };
    const verify: Record<string, Buffer> = { [active.id]: active.secret };
    for (const previous of record.previousKeys) {
      if (previous.expiresAt && Date.parse(previous.expiresAt) > now)
        verify[previous.id] = this.#protector.decrypt(previous.ciphertext);
    }
    return { active, verify };
  }

  async deliveryTarget(
    subscriptionId: string,
  ): Promise<{ endpoint: string; tenantId: string; state: SubscriptionState }> {
    const record = await this.#store.get(subscriptionId);
    if (!record || record.state === 'deleted') throw new SubscriptionError('not_found', 404);
    return { endpoint: record.endpoint, tenantId: record.tenantId, state: record.state };
  }

  private async emit(
    action: WebhookAuditAction,
    actor: Pick<SubscriptionActor, 'ownerId' | 'tenantId'>,
    targetId: string,
    reason: string,
  ): Promise<void> {
    await this.#audit.emit({
      action,
      ownerId: actor.ownerId,
      tenantId: actor.tenantId,
      targetId,
      occurredAt: new Date(this.#now()).toISOString(),
      reason: boundedReason(reason),
    });
  }
}

function suppliedSecret(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43,86}$/.test(value)) throw new SubscriptionError('invalid_secret', 400);
  let secret: Buffer;
  try {
    secret = Buffer.from(value, 'base64url');
  } catch {
    throw new SubscriptionError('invalid_secret', 400);
  }
  if (secret.length < 32 || secret.length > 64 || secret.toString('base64url') !== value)
    throw new SubscriptionError('invalid_secret', 400);
  return secret;
}

export class SubscriptionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'SubscriptionError';
  }
}

function metadata(record: SubscriptionRecord): SubscriptionMetadata {
  const { activeKey, previousKeys, ...safe } = structuredClone(record);
  return {
    ...safe,
    ...(record.state === 'deleted' ? {} : { activeKeyId: activeKey.id }),
    previousKeyIds: previousKeys.map((key) => key.id),
  };
}

async function owned(
  store: SubscriptionStore,
  actor: SubscriptionActor,
  id: string,
): Promise<SubscriptionRecord> {
  const record = await store.get(id);
  if (
    !record ||
    record.state === 'deleted' ||
    record.ownerId !== actor.ownerId ||
    record.tenantId !== actor.tenantId
  )
    throw new SubscriptionError('not_found', 404);
  return record;
}

function boundedReason(reason: string): string {
  return reason.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 120) || 'unspecified';
}

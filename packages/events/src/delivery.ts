import { createHash, randomUUID } from 'node:crypto';
import { NullWebhookAuditSink, type WebhookAuditSink } from './audit.js';
import type { WebhookEventEnvelope } from './generated/events.js';
import { WebhookMetrics } from './metrics.js';
import { signWebhook } from './signing.js';
import { SubscriptionError, SubscriptionService, type SubscriptionActor } from './subscriptions.js';
import {
  DeliveryTransportError,
  type DeliveryTransport,
  type DeliveryTransportResponse,
} from './transport.js';

export type DeliveryState = 'queued' | 'retry_scheduled' | 'succeeded' | 'terminal' | 'dead_letter';

export interface DeliveryRecord {
  id: string;
  eventId: string;
  subscriptionId: string;
  tenantId: string;
  event: WebhookEventEnvelope;
  state: DeliveryState;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  replayCount: number;
  lastAttemptId?: string;
  lastStatus?: number;
  lastErrorCode?: string;
  lastLatencyMs?: number;
}

export interface DeliveryStore {
  create(record: DeliveryRecord): Promise<boolean>;
  get(id: string): Promise<DeliveryRecord | undefined>;
  save(record: DeliveryRecord): Promise<void>;
  due(now: number, limit: number): Promise<DeliveryRecord[]>;
  history(tenantId: string, subscriptionId?: string): Promise<DeliveryRecord[]>;
}

export class InMemoryDeliveryStore implements DeliveryStore {
  readonly records = new Map<string, DeliveryRecord>();

  constructor(readonly maximumRecords = 10_000) {}

  async create(record: DeliveryRecord): Promise<boolean> {
    if (this.records.has(record.id)) return false;
    this.records.set(record.id, structuredClone(record));
    this.prune();
    return true;
  }

  async get(id: string): Promise<DeliveryRecord | undefined> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  async save(record: DeliveryRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
    this.prune();
  }

  async due(now: number, limit: number): Promise<DeliveryRecord[]> {
    const byTenant = new Map<string, DeliveryRecord[]>();
    for (const record of this.records.values()) {
      if (
        (record.state === 'queued' || record.state === 'retry_scheduled') &&
        record.nextAttemptAt <= now
      ) {
        const queue = byTenant.get(record.tenantId) ?? [];
        queue.push(record);
        byTenant.set(record.tenantId, queue);
      }
    }
    for (const queue of byTenant.values())
      queue.sort(
        (left, right) =>
          left.nextAttemptAt - right.nextAttemptAt || left.id.localeCompare(right.id),
      );
    const result: DeliveryRecord[] = [];
    const tenants = [...byTenant.keys()].sort();
    while (result.length < limit && tenants.length > 0) {
      const tenant = tenants.shift() as string;
      const queue = byTenant.get(tenant) as DeliveryRecord[];
      result.push(structuredClone(queue.shift() as DeliveryRecord));
      if (queue.length > 0) tenants.push(tenant);
    }
    return result;
  }

  async history(tenantId: string, subscriptionId?: string): Promise<DeliveryRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.tenantId === tenantId &&
          (subscriptionId === undefined || record.subscriptionId === subscriptionId),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((record) => structuredClone(record));
  }

  private prune(): void {
    if (this.records.size <= this.maximumRecords) return;
    const completed = [...this.records.values()]
      .filter((record) => !['queued', 'retry_scheduled'].includes(record.state))
      .sort((left, right) => left.updatedAt - right.updatedAt);
    while (this.records.size > this.maximumRecords && completed.length > 0) {
      this.records.delete((completed.shift() as DeliveryRecord).id);
    }
  }
}

export interface RetryPolicy {
  maximumAttempts: number;
  baseDelayMs: number;
  maximumDelayMs: number;
  maximumRetryAfterMs: number;
  requestTimeoutMs: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maximumAttempts: 8,
  baseDelayMs: 5_000,
  maximumDelayMs: 3_600_000,
  maximumRetryAfterMs: 3_600_000,
  requestTimeoutMs: 10_000,
};

export class WebhookDispatcher {
  readonly #subscriptions: SubscriptionService;
  readonly #deliveries: DeliveryStore;
  readonly #transport: DeliveryTransport;
  readonly #policy: RetryPolicy;
  readonly #metrics: WebhookMetrics;
  readonly #now: () => number;
  readonly #random: () => number;
  readonly #audit: WebhookAuditSink;

  constructor(options: {
    subscriptions: SubscriptionService;
    deliveries: DeliveryStore;
    transport: DeliveryTransport;
    retryPolicy?: Partial<RetryPolicy>;
    metrics?: WebhookMetrics;
    now?: () => number;
    random?: () => number;
    audit?: WebhookAuditSink;
  }) {
    this.#subscriptions = options.subscriptions;
    this.#deliveries = options.deliveries;
    this.#transport = options.transport;
    this.#policy = { ...DEFAULT_RETRY_POLICY, ...options.retryPolicy };
    this.#metrics = options.metrics ?? new WebhookMetrics();
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? Math.random;
    this.#audit = options.audit ?? new NullWebhookAuditSink();
  }

  get metrics(): WebhookMetrics {
    return this.#metrics;
  }

  async fanout(event: WebhookEventEnvelope): Promise<number> {
    const subscriptions = await this.#subscriptions.matching(event);
    let created = 0;
    for (const subscription of subscriptions) {
      const id = stableDeliveryId(event.id, subscription.id);
      const now = this.#now();
      if (
        await this.#deliveries.create({
          id,
          eventId: event.id,
          subscriptionId: subscription.id,
          tenantId: event.tenantId,
          event: structuredClone(event),
          state: 'queued',
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
          replayCount: 0,
        })
      )
        created += 1;
    }
    return created;
  }

  async fanoutTo(event: WebhookEventEnvelope, subscriptionId: string): Promise<boolean> {
    const target = await this.#subscriptions.deliveryTarget(subscriptionId);
    if (target.state !== 'active' || target.tenantId !== event.tenantId)
      throw new SubscriptionError('not_active', 409);
    const now = this.#now();
    return this.#deliveries.create({
      id: stableDeliveryId(event.id, subscriptionId),
      eventId: event.id,
      subscriptionId,
      tenantId: event.tenantId,
      event: structuredClone(event),
      state: 'queued',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
      replayCount: 0,
    });
  }

  async dispatchDue(limit = 100): Promise<number> {
    const now = this.#now();
    const due = await this.#deliveries.due(now, limit);
    for (const record of due) await this.attempt(record, now);
    return due.length;
  }

  async replay(actor: SubscriptionActor, deliveryId: string): Promise<DeliveryRecord> {
    if (!actor.canReplay) throw new SubscriptionError('replay_forbidden', 403);
    const record = await this.#deliveries.get(deliveryId);
    if (!record || record.tenantId !== actor.tenantId)
      throw new SubscriptionError('not_found', 404);
    record.state = 'queued';
    record.nextAttemptAt = this.#now();
    record.updatedAt = this.#now();
    record.replayCount += 1;
    delete record.lastErrorCode;
    await this.#deliveries.save(record);
    await this.#audit.emit({
      action: 'delivery_replayed',
      ownerId: actor.ownerId,
      tenantId: actor.tenantId,
      targetId: deliveryId,
      occurredAt: new Date(this.#now()).toISOString(),
      reason: 'operator_replayed',
    });
    this.#metrics.increment('delivery_replayed');
    return redacted(record);
  }

  async history(actor: SubscriptionActor, subscriptionId?: string): Promise<DeliveryRecord[]> {
    return (await this.#deliveries.history(actor.tenantId, subscriptionId)).map(redacted);
  }

  private async attempt(record: DeliveryRecord, now: number): Promise<void> {
    record.attempts += 1;
    record.updatedAt = now;
    record.lastAttemptId = `att_${randomUUID().replaceAll('-', '')}`;
    this.#metrics.increment('delivery_attempted');
    try {
      const target = await this.#subscriptions.deliveryTarget(record.subscriptionId);
      if (target.state !== 'active' || target.tenantId !== record.tenantId)
        throw new DeliveryTransportError('subscription_inactive', false);
      const keys = await this.#subscriptions.signingKeys(record.subscriptionId);
      const body = Buffer.from(JSON.stringify(record.event));
      const signedHeaders = signWebhook({
        event: record.event,
        rawBody: body,
        deliveryId: record.id,
        keyId: keys.active.id,
        secret: keys.active.secret,
        timestamp: Math.floor(now / 1_000),
        attemptId: record.lastAttemptId,
      });
      const headers = Object.fromEntries(
        Object.entries(signedHeaders).filter((entry): entry is [string, string] =>
          Boolean(entry[1]),
        ),
      );
      const response = await this.#transport.send({
        endpoint: target.endpoint,
        rawBody: body,
        headers,
        timeoutMs: this.#policy.requestTimeoutMs,
      });
      await this.applyResponse(record, response, now);
    } catch (error) {
      const transport =
        error instanceof DeliveryTransportError
          ? error
          : new DeliveryTransportError('internal_delivery_error', true);
      if (transport.security) {
        this.#metrics.increment('destination_blocked');
        await this.#subscriptions.disable(record.subscriptionId, transport.code);
      }
      await this.applyFailure(record, transport.code, transport.retryable, now);
    }
  }

  private async applyResponse(
    record: DeliveryRecord,
    response: DeliveryTransportResponse,
    now: number,
  ): Promise<void> {
    record.lastStatus = response.status;
    record.lastLatencyMs = response.latencyMs;
    this.#metrics.observeLatency(response.latencyMs);
    if (response.status >= 200 && response.status <= 299) {
      record.state = 'succeeded';
      record.updatedAt = now;
      delete record.lastErrorCode;
      this.#metrics.increment('delivery_succeeded');
      await this.#deliveries.save(record);
      return;
    }
    const retryable =
      [408, 425, 429].includes(response.status) ||
      (response.status >= 500 && response.status <= 599);
    const retryAfterMs = retryable
      ? parseRetryAfter(response.headers['retry-after'], now)
      : undefined;
    await this.applyFailure(record, `http_${response.status}`, retryable, now, retryAfterMs);
    if ([400, 401, 403, 404, 410, 422].includes(response.status))
      await this.#subscriptions.disable(record.subscriptionId, `http_${response.status}`);
  }

  private async applyFailure(
    record: DeliveryRecord,
    code: string,
    retryable: boolean,
    now: number,
    retryAfterMs?: number,
  ): Promise<void> {
    record.lastErrorCode = code.slice(0, 120);
    record.updatedAt = now;
    if (retryable && record.attempts < this.#policy.maximumAttempts) {
      record.state = 'retry_scheduled';
      record.nextAttemptAt =
        now + retryDelay(record.attempts, retryAfterMs, this.#policy, this.#random);
      this.#metrics.increment('delivery_retried');
    } else if (retryable) {
      record.state = 'dead_letter';
      this.#metrics.increment('delivery_dead_lettered');
    } else {
      record.state = 'terminal';
      this.#metrics.increment('delivery_terminal');
    }
    await this.#deliveries.save(record);
  }
}

export function retryDelay(
  attempt: number,
  retryAfterMs: number | undefined,
  policy: RetryPolicy,
  random: () => number,
): number {
  if (retryAfterMs !== undefined)
    return Math.max(0, Math.min(retryAfterMs, policy.maximumRetryAfterMs));
  const exponential = Math.min(
    policy.maximumDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  return Math.max(1, Math.floor(exponential * (0.75 + Math.min(1, Math.max(0, random())) * 0.5)));
}

function parseRetryAfter(value: string | undefined, now: number): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value) * 1_000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

function stableDeliveryId(eventId: string, subscriptionId: string): string {
  return `dlv_${createHash('sha256').update(`${eventId}\u0000${subscriptionId}`).digest('base64url').slice(0, 32)}`;
}

function redacted(record: DeliveryRecord): DeliveryRecord {
  const copy = structuredClone(record);
  copy.event = {
    ...copy.event,
    data: {
      summary: '',
      categories: [],
      geographies: [],
      entities: [],
      assets: [],
      impactPaths: [],
      provenance: [],
    },
  };
  return copy;
}

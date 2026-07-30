/**
 * Durable PostgreSQL adapters for the production webhook service.
 *
 * Every port that the development entrypoint satisfied with an in-memory map is
 * implemented here against a single PostgreSQL schema so subscriptions, queued
 * events, and delivery state survive process restarts.
 */
import type { WebhookAuditEvent, WebhookAuditSink } from '../audit.js';
import type { DeliveryRecord, DeliveryState, DeliveryStore } from '../delivery.js';
import type { SubscriptionFilters } from '../filters.js';
import type { WebhookEventEnvelope, WebhookEventType } from '../generated/events.js';
import type { OutboxRecord, OutboxStore } from '../outbox.js';
import type { EventQueue } from '../queue.js';
import type { SubscriptionRecord, SubscriptionState, SubscriptionStore } from '../subscriptions.js';
import type { SqlClient, SqlPool } from './sql.js';

export const WEBHOOK_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS webhook_subscriptions (
     id text PRIMARY KEY,
     owner_id text NOT NULL,
     tenant_id text NOT NULL,
     endpoint text NOT NULL,
     event_types jsonb NOT NULL,
     filters jsonb NOT NULL,
     state text NOT NULL,
     active_key_id text NOT NULL,
     active_key_ciphertext text NOT NULL,
     previous_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
     created_at text NOT NULL,
     verified_at text,
     last_delivery_at text,
     paused_reason text,
     deleted_at text,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant_state
     ON webhook_subscriptions (tenant_id, state)`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_owner
     ON webhook_subscriptions (owner_id, tenant_id)`,
  `CREATE TABLE IF NOT EXISTS webhook_deliveries (
     id text PRIMARY KEY,
     event_id text NOT NULL,
     subscription_id text NOT NULL,
     tenant_id text NOT NULL,
     event jsonb NOT NULL,
     state text NOT NULL,
     attempts integer NOT NULL DEFAULT 0,
     next_attempt_at bigint NOT NULL,
     created_at bigint NOT NULL,
     updated_at bigint NOT NULL,
     replay_count integer NOT NULL DEFAULT 0,
     last_attempt_id text,
     last_status integer,
     last_error_code text,
     last_latency_ms integer,
     lease_owner text,
     lease_until bigint
   )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
     ON webhook_deliveries (state, next_attempt_at)`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_history
     ON webhook_deliveries (tenant_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription
     ON webhook_deliveries (subscription_id, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS webhook_outbox (
     id text PRIMARY KEY,
     unique_key text NOT NULL UNIQUE,
     event jsonb NOT NULL,
     state text NOT NULL,
     created_at bigint NOT NULL,
     lease_owner text,
     lease_until bigint,
     queued_at bigint
   )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending
     ON webhook_outbox (state, created_at)`,
  `CREATE TABLE IF NOT EXISTS webhook_queue (
     event_id text PRIMARY KEY,
     tenant_id text NOT NULL,
     event jsonb NOT NULL,
     sequence bigserial NOT NULL,
     enqueued_at bigint NOT NULL,
     lease_owner text,
     lease_until bigint
   )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_queue_tenant
     ON webhook_queue (tenant_id, sequence)`,
  `CREATE TABLE IF NOT EXISTS webhook_queue_cursor (
     tenant_id text PRIMARY KEY,
     served_at bigint NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS webhook_audit (
     id bigserial PRIMARY KEY,
     action text NOT NULL,
     owner_id text NOT NULL,
     tenant_id text NOT NULL,
     target_id text NOT NULL,
     occurred_at text NOT NULL,
     reason text NOT NULL,
     recorded_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_audit_target
     ON webhook_audit (tenant_id, target_id, id DESC)`,
];

export async function migrateWebhookSchema(pool: SqlPool): Promise<void> {
  for (const statement of WEBHOOK_SCHEMA_STATEMENTS) await pool.query(statement);
}

interface SubscriptionRow {
  id: string;
  owner_id: string;
  tenant_id: string;
  endpoint: string;
  event_types: string[];
  filters: SubscriptionFilters;
  state: string;
  active_key_id: string;
  active_key_ciphertext: string;
  previous_keys: Array<{ id: string; ciphertext: string; expiresAt?: string }>;
  created_at: string;
  verified_at: string | null;
  last_delivery_at: string | null;
  paused_reason: string | null;
  deleted_at: string | null;
}

export class PostgresSubscriptionStore implements SubscriptionStore {
  constructor(private readonly pool: SqlPool) {}

  async save(record: SubscriptionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO webhook_subscriptions (
         id, owner_id, tenant_id, endpoint, event_types, filters, state,
         active_key_id, active_key_ciphertext, previous_keys, created_at,
         verified_at, last_delivery_at, paused_reason, deleted_at, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15, now())
       ON CONFLICT (id) DO UPDATE SET
         endpoint = EXCLUDED.endpoint,
         event_types = EXCLUDED.event_types,
         filters = EXCLUDED.filters,
         state = EXCLUDED.state,
         active_key_id = EXCLUDED.active_key_id,
         active_key_ciphertext = EXCLUDED.active_key_ciphertext,
         previous_keys = EXCLUDED.previous_keys,
         verified_at = EXCLUDED.verified_at,
         last_delivery_at = EXCLUDED.last_delivery_at,
         paused_reason = EXCLUDED.paused_reason,
         deleted_at = EXCLUDED.deleted_at,
         updated_at = now()`,
      [
        record.id,
        record.ownerId,
        record.tenantId,
        record.endpoint,
        JSON.stringify(record.eventTypes),
        JSON.stringify(record.filters),
        record.state,
        record.activeKey.id,
        record.activeKey.ciphertext,
        JSON.stringify(record.previousKeys),
        record.createdAt,
        record.verifiedAt ?? null,
        record.lastDeliveryAt ?? null,
        record.pausedReason ?? null,
        record.deletedAt ?? null,
      ],
    );
  }

  async get(id: string): Promise<SubscriptionRecord | undefined> {
    const result = await this.pool.query<SubscriptionRow>(
      'SELECT * FROM webhook_subscriptions WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? toSubscription(row) : undefined;
  }

  async list(ownerId?: string, tenantId?: string): Promise<SubscriptionRecord[]> {
    const result = await this.pool.query<SubscriptionRow>(
      `SELECT * FROM webhook_subscriptions
       WHERE ($1::text IS NULL OR owner_id = $1)
         AND ($2::text IS NULL OR tenant_id = $2)
       ORDER BY created_at ASC`,
      [ownerId ?? null, tenantId ?? null],
    );
    return result.rows.map(toSubscription);
  }

  /** Removes subscription rows that were soft-deleted before the cutoff. */
  async purgeDeleted(before: Date): Promise<number> {
    const result = await this.pool.query<{ id: string }>(
      `DELETE FROM webhook_subscriptions
       WHERE state = 'deleted' AND deleted_at IS NOT NULL AND deleted_at < $1
       RETURNING id`,
      [before.toISOString()],
    );
    return result.rows.length;
  }
}

function toSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    tenantId: row.tenant_id,
    endpoint: row.endpoint,
    eventTypes: row.event_types as WebhookEventType[],
    filters: row.filters ?? {},
    state: row.state as SubscriptionState,
    activeKey: { id: row.active_key_id, ciphertext: row.active_key_ciphertext },
    previousKeys: row.previous_keys ?? [],
    createdAt: row.created_at,
    ...(row.verified_at ? { verifiedAt: row.verified_at } : {}),
    ...(row.last_delivery_at ? { lastDeliveryAt: row.last_delivery_at } : {}),
    ...(row.paused_reason ? { pausedReason: row.paused_reason } : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

interface DeliveryRow {
  id: string;
  event_id: string;
  subscription_id: string;
  tenant_id: string;
  event: WebhookEventEnvelope;
  state: string;
  attempts: number | string;
  next_attempt_at: number | string;
  created_at: number | string;
  updated_at: number | string;
  replay_count: number | string;
  last_attempt_id: string | null;
  last_status: number | null;
  last_error_code: string | null;
  last_latency_ms: number | null;
}

/**
 * Delivery state backed by PostgreSQL. `due()` leases rows round-robin across
 * tenants so one noisy tenant cannot starve the others, and the lease makes a
 * mid-attempt crash recoverable instead of silently losing the delivery.
 */
export class PostgresDeliveryStore implements DeliveryStore {
  readonly #owner = `dispatcher-${process.pid}`;

  constructor(
    private readonly pool: SqlPool,
    private readonly leaseMs = 120_000,
    private readonly historyLimit = 200,
  ) {}

  async create(record: DeliveryRecord): Promise<boolean> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO webhook_deliveries (
         id, event_id, subscription_id, tenant_id, event, state, attempts,
         next_attempt_at, created_at, updated_at, replay_count)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        record.id,
        record.eventId,
        record.subscriptionId,
        record.tenantId,
        JSON.stringify(record.event),
        record.state,
        record.attempts,
        record.nextAttemptAt,
        record.createdAt,
        record.updatedAt,
        record.replayCount,
      ],
    );
    return result.rows.length > 0;
  }

  async get(id: string): Promise<DeliveryRecord | undefined> {
    const result = await this.pool.query<DeliveryRow>(
      'SELECT * FROM webhook_deliveries WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? toDelivery(row) : undefined;
  }

  async save(record: DeliveryRecord): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_deliveries SET
         state = $2, attempts = $3, next_attempt_at = $4, updated_at = $5,
         replay_count = $6, last_attempt_id = $7, last_status = $8,
         last_error_code = $9, last_latency_ms = $10,
         lease_owner = NULL, lease_until = NULL
       WHERE id = $1`,
      [
        record.id,
        record.state,
        record.attempts,
        record.nextAttemptAt,
        record.updatedAt,
        record.replayCount,
        record.lastAttemptId ?? null,
        record.lastStatus ?? null,
        record.lastErrorCode ?? null,
        record.lastLatencyMs ?? null,
      ],
    );
  }

  async due(now: number, limit: number): Promise<DeliveryRecord[]> {
    return this.pool.transaction(async (client) => {
      const tenants = await client.query<{ tenant_id: string }>(
        `SELECT d.tenant_id
         FROM webhook_deliveries d
         LEFT JOIN webhook_queue_cursor c ON c.tenant_id = d.tenant_id
         WHERE d.state IN ('queued','retry_scheduled')
           AND d.next_attempt_at <= $1
           AND (d.lease_owner IS NULL OR d.lease_until <= $1)
         GROUP BY d.tenant_id, c.served_at
         ORDER BY COALESCE(c.served_at, 0) ASC, d.tenant_id ASC`,
        [now],
      );
      const selected: DeliveryRecord[] = [];
      const perTenant = Math.max(1, Math.ceil(limit / Math.max(1, tenants.rows.length)));
      for (const tenant of tenants.rows) {
        if (selected.length >= limit) break;
        const claimed = await client.query<DeliveryRow>(
          `UPDATE webhook_deliveries SET lease_owner = $3, lease_until = $4
           WHERE id IN (
             SELECT id FROM webhook_deliveries
             WHERE tenant_id = $1
               AND state IN ('queued','retry_scheduled')
               AND next_attempt_at <= $2
               AND (lease_owner IS NULL OR lease_until <= $2)
             ORDER BY next_attempt_at ASC, id ASC
             LIMIT $5
             FOR UPDATE SKIP LOCKED)
           RETURNING *`,
          [
            tenant.tenant_id,
            now,
            this.#owner,
            now + this.leaseMs,
            Math.min(perTenant, limit - selected.length),
          ],
        );
        for (const row of claimed.rows) selected.push(toDelivery(row));
        await client.query(
          `INSERT INTO webhook_queue_cursor (tenant_id, served_at) VALUES ($1, $2)
           ON CONFLICT (tenant_id) DO UPDATE SET served_at = EXCLUDED.served_at`,
          [tenant.tenant_id, now],
        );
      }
      return selected;
    });
  }

  async history(tenantId: string, subscriptionId?: string): Promise<DeliveryRecord[]> {
    const result = await this.pool.query<DeliveryRow>(
      `SELECT * FROM webhook_deliveries
       WHERE tenant_id = $1 AND ($2::text IS NULL OR subscription_id = $2)
       ORDER BY updated_at DESC
       LIMIT $3`,
      [tenantId, subscriptionId ?? null, this.historyLimit],
    );
    return result.rows.map(toDelivery);
  }

  /** Counts deliveries that are still waiting to be attempted. */
  async pendingDepth(): Promise<{ depth: number; oldestAgeSeconds: number }> {
    const result = await this.pool.query<{ depth: string; oldest: string | null }>(
      `SELECT COUNT(*)::text AS depth, MIN(created_at)::text AS oldest
       FROM webhook_deliveries WHERE state IN ('queued','retry_scheduled')`,
    );
    const row = result.rows[0];
    const oldest = row?.oldest ? Number(row.oldest) : 0;
    return {
      depth: Number(row?.depth ?? 0),
      oldestAgeSeconds: oldest > 0 ? Math.max(0, Math.floor((Date.now() - oldest) / 1_000)) : 0,
    };
  }

  /** Applies the configured retention windows to completed delivery rows. */
  async prune(now: number, detailedDays: number, deadLetterDays: number): Promise<number> {
    const result = await this.pool.query<{ id: string }>(
      `DELETE FROM webhook_deliveries
       WHERE (state IN ('succeeded','terminal') AND updated_at < $1)
          OR (state = 'dead_letter' AND updated_at < $2)
       RETURNING id`,
      [now - detailedDays * 86_400_000, now - deadLetterDays * 86_400_000],
    );
    return result.rows.length;
  }
}

function toDelivery(row: DeliveryRow): DeliveryRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    subscriptionId: row.subscription_id,
    tenantId: row.tenant_id,
    event: row.event,
    state: row.state as DeliveryState,
    attempts: Number(row.attempts),
    nextAttemptAt: Number(row.next_attempt_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    replayCount: Number(row.replay_count),
    ...(row.last_attempt_id ? { lastAttemptId: row.last_attempt_id } : {}),
    ...(row.last_status === null ? {} : { lastStatus: Number(row.last_status) }),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
    ...(row.last_latency_ms === null ? {} : { lastLatencyMs: Number(row.last_latency_ms) }),
  };
}

interface OutboxRow {
  id: string;
  unique_key: string;
  event: WebhookEventEnvelope;
  state: string;
  created_at: number | string;
  lease_owner: string | null;
  lease_until: number | string | null;
  queued_at: number | string | null;
}

/**
 * Transactional outbox. `appendUnique` can be executed inside the caller's own
 * transaction so the publish commit and the outbox row share one atomic unit.
 */
export class PostgresOutboxStore implements OutboxStore {
  constructor(private readonly pool: SqlPool) {}

  async appendUnique(record: OutboxRecord, client: SqlClient = this.pool): Promise<boolean> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO webhook_outbox (id, unique_key, event, state, created_at)
       VALUES ($1,$2,$3::jsonb,$4,$5)
       ON CONFLICT (unique_key) DO NOTHING
       RETURNING id`,
      [
        record.id,
        encodeUniqueKey(record.uniqueKey),
        JSON.stringify(record.event),
        record.state,
        record.createdAt,
      ],
    );
    return result.rows.length > 0;
  }

  async lease(owner: string, now: number, leaseMs: number, limit: number): Promise<OutboxRecord[]> {
    const result = await this.pool.query<OutboxRow>(
      `UPDATE webhook_outbox SET state = 'leased', lease_owner = $1, lease_until = $2
       WHERE id IN (
         SELECT id FROM webhook_outbox
         WHERE state = 'pending' OR (state = 'leased' AND COALESCE(lease_until, 0) <= $3)
         ORDER BY created_at ASC, id ASC
         LIMIT $4
         FOR UPDATE SKIP LOCKED)
       RETURNING *`,
      [owner, now + leaseMs, now, limit],
    );
    return result.rows.map(toOutbox);
  }

  async markQueued(id: string, owner: string, now: number): Promise<void> {
    const result = await this.pool.query<{ id: string }>(
      `UPDATE webhook_outbox
       SET state = 'queued', queued_at = $3, lease_owner = NULL, lease_until = NULL
       WHERE id = $1 AND state = 'leased' AND lease_owner = $2
       RETURNING id`,
      [id, owner, now],
    );
    if (result.rows.length === 0) throw new Error('outbox lease lost');
  }

  async reconcile(now: number): Promise<OutboxRecord[]> {
    const result = await this.pool.query<OutboxRow>(
      `SELECT * FROM webhook_outbox
       WHERE state = 'pending' OR (state = 'leased' AND COALESCE(lease_until, 0) <= $1)
       ORDER BY created_at ASC`,
      [now],
    );
    return result.rows.map(toOutbox);
  }

  /** Drops relayed outbox rows once they are older than the retention window. */
  async prune(now: number, days: number): Promise<number> {
    const result = await this.pool.query<{ id: string }>(
      `DELETE FROM webhook_outbox WHERE state = 'queued' AND queued_at < $1 RETURNING id`,
      [now - days * 86_400_000],
    );
    return result.rows.length;
  }
}

/**
 * The producer's uniqueness key is `tenant\0resource\0revision\0type`, and a
 * PostgreSQL `text` column cannot hold a NUL byte. Encoding preserves the exact
 * key bytes, so the uniqueness guarantee is unchanged and reads round-trip.
 */
export function encodeUniqueKey(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeUniqueKey(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function toOutbox(row: OutboxRow): OutboxRecord {
  return {
    id: row.id,
    uniqueKey: decodeUniqueKey(row.unique_key),
    event: row.event,
    state: row.state as OutboxRecord['state'],
    createdAt: Number(row.created_at),
    ...(row.lease_owner ? { leaseOwner: row.lease_owner } : {}),
    ...(row.lease_until === null ? {} : { leaseUntil: Number(row.lease_until) }),
    ...(row.queued_at === null ? {} : { queuedAt: Number(row.queued_at) }),
  };
}

/**
 * Durable, tenant-fair event queue.
 *
 * `dequeue` leases a row rather than deleting it, so a crash between dequeue and
 * fan-out replays the event instead of dropping it. `commit` removes the row
 * once delivery rows exist, and fan-out is idempotent on the stable delivery ID.
 */
export class PostgresEventQueue implements EventQueue {
  #depth = 0;

  constructor(
    private readonly pool: SqlPool,
    private readonly owner: string,
    private readonly leaseMs = 60_000,
  ) {}

  async enqueue(event: WebhookEventEnvelope): Promise<boolean> {
    const result = await this.pool.query<{ event_id: string }>(
      `INSERT INTO webhook_queue (event_id, tenant_id, event, enqueued_at)
       VALUES ($1,$2,$3::jsonb,$4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.tenantId, JSON.stringify(event), Date.now()],
    );
    return result.rows.length > 0;
  }

  async dequeue(): Promise<WebhookEventEnvelope | undefined> {
    const now = Date.now();
    return this.pool.transaction(async (client) => {
      const tenant = await client.query<{ tenant_id: string }>(
        `SELECT q.tenant_id
         FROM webhook_queue q
         LEFT JOIN webhook_queue_cursor c ON c.tenant_id = q.tenant_id
         WHERE q.lease_owner IS NULL OR COALESCE(q.lease_until, 0) <= $1
         GROUP BY q.tenant_id, c.served_at
         ORDER BY COALESCE(c.served_at, 0) ASC, MIN(q.sequence) ASC
         LIMIT 1`,
        [now],
      );
      const target = tenant.rows[0];
      if (!target) return undefined;
      const claimed = await client.query<{ event: WebhookEventEnvelope }>(
        `UPDATE webhook_queue SET lease_owner = $2, lease_until = $3
         WHERE event_id IN (
           SELECT event_id FROM webhook_queue
           WHERE tenant_id = $1 AND (lease_owner IS NULL OR COALESCE(lease_until, 0) <= $4)
           ORDER BY sequence ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
         RETURNING event`,
        [target.tenant_id, this.owner, now + this.leaseMs, now],
      );
      await client.query(
        `INSERT INTO webhook_queue_cursor (tenant_id, served_at) VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO UPDATE SET served_at = EXCLUDED.served_at`,
        [target.tenant_id, now],
      );
      return claimed.rows[0]?.event;
    });
  }

  /** Removes a leased event after its delivery rows are durably created. */
  async commit(eventId: string): Promise<void> {
    await this.pool.query('DELETE FROM webhook_queue WHERE event_id = $1 AND lease_owner = $2', [
      eventId,
      this.owner,
    ]);
  }

  /** Releases a lease so the event is retried by the next worker pass. */
  async release(eventId: string): Promise<void> {
    await this.pool.query(
      'UPDATE webhook_queue SET lease_owner = NULL, lease_until = NULL WHERE event_id = $1',
      [eventId],
    );
  }

  size(): number {
    return this.#depth;
  }

  async refreshDepth(): Promise<number> {
    const result = await this.pool.query<{ depth: string }>(
      'SELECT COUNT(*)::text AS depth FROM webhook_queue',
    );
    this.#depth = Number(result.rows[0]?.depth ?? 0);
    return this.#depth;
  }
}

export class PostgresAuditSink implements WebhookAuditSink {
  constructor(private readonly pool: SqlPool) {}

  async emit(event: WebhookAuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO webhook_audit (action, owner_id, tenant_id, target_id, occurred_at, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [event.action, event.ownerId, event.tenantId, event.targetId, event.occurredAt, event.reason],
    );
  }

  async prune(now: number, days: number): Promise<number> {
    const result = await this.pool.query<{ id: string }>(
      'DELETE FROM webhook_audit WHERE recorded_at < to_timestamp($1) RETURNING id',
      [(now - days * 86_400_000) / 1_000],
    );
    return result.rows.length;
  }
}

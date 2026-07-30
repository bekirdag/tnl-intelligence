#!/usr/bin/env node
/**
 * Production probe for the transactional outbox, relay, and tenant-fair queue.
 *
 * Writes an outbox row the way the TNL publish transaction would, then watches
 * the running service relay it into the durable queue and fan it out into a
 * delivery. Also asserts the uniqueness key, so a replayed publish cannot create
 * a second event.
 *
 * Run on the production host with the service environment loaded:
 *   sudo env $(cat /etc/tnl-webhooks/env | xargs) \
 *     TNL_WEBHOOK_CONFIG=/etc/tnl-webhooks/config.yaml \
 *     node scripts/webhook-outbox-probe.mjs
 */
import { randomUUID } from 'node:crypto';

const distributionPath = process.env.TNL_WEBHOOK_DIST ?? '/srv/tnl-webhooks/current/dist/index.js';
const { createPostgresPool, PostgresOutboxStore, createWebhookEvent } = await import(
  distributionPath
);

const databaseUrl = process.env.TNL_WEBHOOK_DATABASE_URL;
if (!databaseUrl) throw new Error('TNL_WEBHOOK_DATABASE_URL must be set');
const tenantId = process.env.TNL_PROBE_TENANT ?? 'tnl_public';
const pool = await createPostgresPool({ connectionString: databaseUrl, maxConnections: 2 });
const outbox = new PostgresOutboxStore(pool);

const resourceId = `story_probe_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const now = new Date();
const event = createWebhookEvent({
  id: `evt_probe${randomUUID().replaceAll('-', '').slice(0, 16)}`,
  type: 'intelligence.published',
  tenantId,
  occurredAt: now.toISOString(),
  publishedAt: now.toISOString(),
  traceId: `outbox-probe-${resourceId}`,
  resource: {
    id: resourceId,
    revision: 1,
    url: 'https://theneuralledger.com/developers/webhooks',
  },
  data: {
    summary: 'Production outbox relay probe.',
    categories: ['technology'],
    geographies: [],
    entities: [],
    assets: [],
    impactPaths: [],
    confidence: 0.9,
    provenance: ['https://theneuralledger.com/developers/webhooks'],
  },
});

const record = {
  id: `out_${event.id.slice(4)}`,
  uniqueKey: `${tenantId}\u0000${resourceId}\u00001\u0000intelligence.published`,
  event,
  state: 'pending',
  createdAt: Date.now(),
};

// A publish transaction writes the outbox row; a retried publish must not
// create a second event, which is what the uniqueness key guarantees.
const first = await pool.transaction((client) => outbox.appendUnique(record, client));
const duplicate = await pool.transaction((client) =>
  outbox.appendUnique({ ...record, id: `${record.id}x` }, client),
);

const result = {
  eventId: event.id,
  outboxId: record.id,
  firstAppend: first,
  duplicateAppend: duplicate,
};

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const outboxRow = await pool.query('SELECT state, queued_at FROM webhook_outbox WHERE id = $1', [
    record.id,
  ]);
  const deliveries = await pool.query(
    'SELECT id, state, attempts, subscription_id FROM webhook_deliveries WHERE event_id = $1',
    [event.id],
  );
  const queued = await pool.query(
    'SELECT count(*)::text AS depth FROM webhook_queue WHERE event_id = $1',
    [event.id],
  );
  result.outboxState = outboxRow.rows[0]?.state;
  result.queueDepthForEvent = Number(queued.rows[0]?.depth ?? 0);
  result.deliveries = deliveries.rows;
  if (result.outboxState === 'queued' && deliveries.rows.some((row) => row.state === 'succeeded'))
    break;
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

console.log(JSON.stringify(result, null, 2));
await pool.close();
process.exit(
  result.firstAppend === true &&
    result.duplicateAppend === false &&
    result.outboxState === 'queued' &&
    (result.deliveries ?? []).some((row) => row.state === 'succeeded')
    ? 0
    : 1,
);

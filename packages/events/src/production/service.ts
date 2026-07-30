/**
 * Assembles the production webhook service from durable adapters.
 *
 * Nothing in this module keeps authoritative state in process memory:
 * subscriptions, queued events, outbox rows, delivery attempts, and audit
 * records all live in PostgreSQL, so a restart resumes exactly where the
 * previous process stopped.
 */
import type { Server } from 'node:http';
import { WebhookChallengeService } from '../challenge.js';
import { WebhookDispatcher } from '../delivery.js';
import { SystemEndpointResolver, type EndpointPolicy } from '../endpoint.js';
import { WebhookMetrics } from '../metrics.js';
import { OutboxRelay } from '../queue.js';
import { createWebhookControlServer } from '../server.js';
import { SubscriptionService } from '../subscriptions.js';
import { PinnedHttpDeliveryTransport } from '../transport.js';
import type { WebhookServiceConfig } from './config.js';
import {
  KeycloakTokenVerifier,
  MysqlMemberKeyDirectory,
  TnlControlAuthenticator,
  type MemberKeyDirectory,
} from './identity.js';
import {
  EnvelopeSecretProtector,
  LocalKeyManagementService,
  PostgresWrappedKeyStore,
  type KeyManagementService,
} from './kms.js';
import {
  migrateWebhookSchema,
  PostgresAuditSink,
  PostgresDeliveryStore,
  PostgresEventQueue,
  PostgresOutboxStore,
  PostgresSubscriptionStore,
} from './postgres.js';
import { createPostgresPool, type SqlPool } from './sql.js';

/** Metrics that also publish durable queue depth and backlog age. */
export class ProductionWebhookMetrics extends WebhookMetrics {
  queueDepth = 0;
  oldestQueuedAgeSeconds = 0;

  override prometheus(
    queueDepth: number = this.queueDepth,
    oldestQueuedAgeSeconds: number = this.oldestQueuedAgeSeconds,
  ): string {
    return super.prometheus(queueDepth, oldestQueuedAgeSeconds);
  }
}

export interface ReadinessReport {
  ready: boolean;
  dependencies: {
    database: 'pass' | 'fail';
    queue: 'pass' | 'fail';
    kms: 'pass' | 'fail';
    identity: 'pass' | 'fail';
  };
}

export interface WebhookProductionService {
  server: Server;
  config: WebhookServiceConfig;
  pool: SqlPool;
  subscriptions: SubscriptionService;
  dispatcher: WebhookDispatcher;
  queue: PostgresEventQueue;
  outbox: PostgresOutboxStore;
  deliveries: PostgresDeliveryStore;
  metrics: ProductionWebhookMetrics;
  readiness(): Promise<ReadinessReport>;
  /** Runs one relay and dispatch pass; returned by the background loop too. */
  tick(): Promise<{ relayed: number; events: number; deliveries: number }>;
  listen(): Promise<void>;
  stop(): Promise<void>;
}

export interface BuildOptions {
  config: WebhookServiceConfig;
  databaseUrl: string;
  keyManagement: KeyManagementService;
  memberDirectory: MemberKeyDirectory;
  instanceId?: string;
}

export async function buildWebhookProductionService(
  options: BuildOptions,
): Promise<WebhookProductionService> {
  const { config } = options;
  const instanceId = options.instanceId ?? `tnl-webhooks-${process.pid}`;
  const pool = await createPostgresPool({
    connectionString: options.databaseUrl,
    maxConnections: config.database.maxConnections,
    applicationName: 'tnl-webhooks',
  });
  await migrateWebhookSchema(pool);

  const protector = new EnvelopeSecretProtector(
    options.keyManagement,
    new PostgresWrappedKeyStore(pool),
  );
  await protector.initialize();

  const audit = new PostgresAuditSink(pool);
  const resolver = new SystemEndpointResolver();
  const endpointPolicy: EndpointPolicy = { allowedPorts: config.egress.allowedPorts };
  const transport = new PinnedHttpDeliveryTransport(resolver, endpointPolicy);
  const subscriptionStore = new PostgresSubscriptionStore(pool);
  const subscriptions = new SubscriptionService({
    store: subscriptionStore,
    protector,
    resolver,
    endpointPolicy,
    audit,
  });
  const deliveries = new PostgresDeliveryStore(pool);
  const metrics = new ProductionWebhookMetrics();
  const dispatcher = new WebhookDispatcher({
    subscriptions,
    deliveries,
    transport,
    metrics,
    audit,
    retryPolicy: {
      maximumAttempts: config.service.maximumAttempts,
      baseDelayMs: config.service.baseDelayMs,
      maximumDelayMs: config.service.maximumDelayMs,
      maximumRetryAfterMs: config.service.maximumRetryAfterMs,
      requestTimeoutMs: config.service.requestTimeoutMs,
    },
  });
  const challenge = new WebhookChallengeService(subscriptions, transport);
  const queue = new PostgresEventQueue(pool, instanceId);
  const outbox = new PostgresOutboxStore(pool);
  const relay = new OutboxRelay(outbox, queue, instanceId);

  const identity = new TnlControlAuthenticator({
    directory: options.memberDirectory,
    ...(config.identity.keycloakJwksUrl
      ? {
          keycloak: new KeycloakTokenVerifier({
            jwksUrl: config.identity.keycloakJwksUrl,
            issuers: config.identity.keycloakIssuers,
            audiences: config.identity.keycloakAudiences,
          }),
        }
      : {}),
    defaultTenantId: config.identity.defaultTenantId,
    tenantOverrides: config.identity.tenantOverrides,
    operatorSubjects: config.identity.operatorSubjects,
    operatorRole: config.identity.operatorRole,
    deniedPlans: config.identity.deniedPlans,
    requestsPerMinute: config.identity.requestsPerMinute,
  });

  async function readiness(): Promise<ReadinessReport> {
    const [database, kms, identityReady] = await Promise.all([
      pool
        .query('SELECT 1')
        .then(() => 'pass' as const)
        .catch(() => 'fail' as const),
      protector
        .health()
        .then((healthy) => (healthy ? ('pass' as const) : ('fail' as const)))
        .catch(() => 'fail' as const),
      identity
        .health()
        .then((healthy) => (healthy ? ('pass' as const) : ('fail' as const)))
        .catch(() => 'fail' as const),
    ]);
    const queueReady = await queue
      .refreshDepth()
      .then(() => 'pass' as const)
      .catch(() => 'fail' as const);
    const dependencies = { database, queue: queueReady, kms, identity: identityReady };
    return {
      ready: Object.values(dependencies).every((value) => value === 'pass'),
      dependencies,
    };
  }

  const server = createWebhookControlServer({
    subscriptions,
    dispatcher,
    challenge,
    identity,
    metrics,
    ready: async () => (await readiness()).ready,
    readiness,
    ...(config.service.autoVerifyOnCreate
      ? {
          afterCreate: async (actor, subscriptionId) => {
            // A consumer that answers the signed challenge is activated during
            // creation, which is what hosted automation platforms expect. A
            // failure leaves the subscription pending and verifiable later.
            try {
              await challenge.verify(actor, subscriptionId);
              return subscriptions.inspect(actor, subscriptionId);
            } catch {
              return undefined;
            }
          },
        }
      : {}),
  });

  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function tick(): Promise<{ relayed: number; events: number; deliveries: number }> {
    let relayed = 0;
    let events = 0;
    let deliveredBatch = 0;
    if (config.service.relayEnabled) {
      relayed = await relay.runOnce(Date.now(), config.service.workerBatch);
      if (relayed > 0) metrics.increment('outbox_relayed', relayed);
    }
    if (config.service.dispatcherEnabled) {
      for (; events < config.service.workerBatch; events += 1) {
        const event = await queue.dequeue();
        if (!event) break;
        try {
          await dispatcher.fanout(event);
          await queue.commit(event.id);
        } catch {
          await queue.release(event.id);
          break;
        }
      }
      deliveredBatch = await dispatcher.dispatchDue(config.service.workerBatch);
    }
    const depth = await deliveries.pendingDepth();
    metrics.queueDepth = (await queue.refreshDepth()) + depth.depth;
    metrics.oldestQueuedAgeSeconds = depth.oldestAgeSeconds;
    return { relayed, events, deliveries: deliveredBatch };
  }

  async function loop(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch {
      // A transient database or network failure must not stop the worker.
    } finally {
      running = false;
    }
  }

  let retention: NodeJS.Timeout | undefined;

  async function prune(): Promise<void> {
    const now = Date.now();
    try {
      await deliveries.prune(
        now,
        config.service.detailedHistoryDays,
        config.service.deadLetterDays,
      );
      await outbox.prune(now, config.service.outboxDays);
      await audit.prune(now, config.service.auditDays);
      await subscriptionStore.purgeDeleted(
        new Date(now - config.service.detailedHistoryDays * 86_400_000),
      );
    } catch {
      // Retention is best effort; the next pass retries.
    }
  }

  return {
    server,
    config,
    pool,
    subscriptions,
    dispatcher,
    queue,
    outbox,
    deliveries,
    metrics,
    readiness,
    tick,
    async listen(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.service.bindPort, config.service.bindHost, () => resolve());
      });
      timer = setInterval(() => void loop(), config.service.workerIntervalMs);
      timer.unref();
      retention = setInterval(() => void prune(), 3_600_000);
      retention.unref();
      await prune();
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      if (retention) clearInterval(retention);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await options.memberDirectory.close();
      await pool.close();
    },
  };
}

/** Resolves the configured key-management provider. */
export async function createKeyManagement(
  config: WebhookServiceConfig,
  environment = process.env,
): Promise<KeyManagementService> {
  if (config.kms.provider !== 'local-keyring')
    throw new Error(`unsupported key management provider: ${config.kms.provider}`);
  const path = environment[config.kms.keyringPathEnv];
  if (!path) throw new Error(`${config.kms.keyringPathEnv} must be set`);
  return LocalKeyManagementService.fromFile(path);
}

/** Resolves the member API-key directory used for production identity. */
export async function createMemberDirectory(
  config: WebhookServiceConfig,
  environment = process.env,
): Promise<MemberKeyDirectory> {
  const password = environment[config.identity.mysqlPasswordEnv];
  if (!password) throw new Error(`${config.identity.mysqlPasswordEnv} must be set`);
  return MysqlMemberKeyDirectory.connect({
    host: config.identity.mysqlHost,
    port: config.identity.mysqlPort,
    user: config.identity.mysqlUser,
    password,
    database: config.identity.mysqlDatabase,
  });
}

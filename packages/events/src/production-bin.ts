#!/usr/bin/env node
/**
 * Production entrypoint for the TNL webhook service.
 *
 * Unlike `service-bin.ts`, which is development-only and refuses to start under
 * `NODE_ENV=production`, this entrypoint requires durable adapters: a
 * PostgreSQL connection, a KMS keyring, and the TNL member key directory. It
 * fails closed when any of them is missing rather than falling back to memory.
 */
import { loadWebhookServiceConfig, requiredEnvironment } from './production/config.js';
import {
  buildWebhookProductionService,
  createKeyManagement,
  createMemberDirectory,
} from './production/service.js';

const configPath = process.env.TNL_WEBHOOK_CONFIG;
if (!configPath) throw new Error('TNL_WEBHOOK_CONFIG must point at the service configuration');

const config = await loadWebhookServiceConfig(configPath);
const databaseUrl = requiredEnvironment(config.database.urlEnv);
const keyManagement = await createKeyManagement(config);
const memberDirectory = await createMemberDirectory(config);

const service = await buildWebhookProductionService({
  config,
  databaseUrl,
  keyManagement,
  memberDirectory,
});

const readiness = await service.readiness();
if (!readiness.ready) {
  console.error(
    `TNL webhook service dependencies are not ready: ${JSON.stringify(readiness.dependencies)}`,
  );
}

await service.listen();
console.log(
  `TNL webhook service listening on http://${config.service.bindHost}:${config.service.bindPort}` +
    ` (relay=${config.service.relayEnabled} dispatcher=${config.service.dispatcherEnabled})`,
);

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void service
      .stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

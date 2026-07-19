#!/usr/bin/env node
import {
  CredentialService,
  InMemoryCredentialStore,
  MemoryCredentialAuditSink,
} from './credentials.js';
import { HeaderSessionAuthenticator } from './identity.js';
import { createOnboardingServer } from './server.js';
import { InMemoryUsageStore } from './usage.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'The local header identity adapter is disabled in production; inject the TNL session adapter.',
  );
}
const credentials = new CredentialService({
  store: new InMemoryCredentialStore(),
  audit: new MemoryCredentialAuditSink(),
});
const server = createOnboardingServer({
  credentials,
  identity: new HeaderSessionAuthenticator(),
  usage: new InMemoryUsageStore(),
  openApiPath: process.env.TNL_OPENAPI_PATH ?? 'openapi/tnl.openapi.json',
  publicUrl: process.env.TNL_ONBOARDING_PUBLIC_URL ?? 'http://127.0.0.1:7320',
});
const host = process.env.TNL_ONBOARDING_HOST ?? '127.0.0.1';
const port = Number(process.env.TNL_ONBOARDING_PORT ?? 7320);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});
process.stderr.write(`TNL developer onboarding listening on ${host}:${port}\n`);

const shutdown = (): void => {
  server.closeAllConnections();
  server.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

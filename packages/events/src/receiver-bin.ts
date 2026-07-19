#!/usr/bin/env node
import { createLocalWebhookReceiver } from './receiver.js';

if (process.env.TNL_WEBHOOK_DEV_RECEIVER !== '1') {
  throw new Error('Set TNL_WEBHOOK_DEV_RECEIVER=1 to run the local HTTP receiver');
}
const secret = process.env.TNL_WEBHOOK_SECRET;
if (!secret) throw new Error('TNL_WEBHOOK_SECRET is required');
const keyId = process.env.TNL_WEBHOOK_KEY_ID ?? 'key_localdev1';
const port = Number(process.env.TNL_WEBHOOK_PORT ?? 7321);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('invalid port');
const server = createLocalWebhookReceiver({
  keys: { [keyId]: Buffer.from(secret, 'base64url') },
  allowDevelopmentHttp: true,
  ...(process.env.TNL_WEBHOOK_RECEIVER_STATUS
    ? { status: Number(process.env.TNL_WEBHOOK_RECEIVER_STATUS) }
    : {}),
  ...(process.env.TNL_WEBHOOK_RECEIVER_DELAY_MS
    ? { delayMs: Number(process.env.TNL_WEBHOOK_RECEIVER_DELAY_MS) }
    : {}),
});
server.listen(port, '127.0.0.1', () => {
  console.log(`TNL local webhook receiver listening on http://127.0.0.1:${port}/webhook`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

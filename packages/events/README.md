# TNL Events

`@theneuralledger/events` provides the versioned TNL webhook envelope, HMAC signing and verification, endpoint policy, encrypted subscription lifecycle, outbox and fair-queue reference ports, bounded delivery state machine, control-plane server, and local receiver.

## Verify a Delivery

Always verify the exact raw bytes before parsing JSON:

```ts
import { InMemoryReplayStore, verifyWebhook } from '@theneuralledger/events';

await verifyWebhook({
  rawBody,
  headers: request.headers,
  keys: { [keyId]: webhookSecret },
  replayStore: new InMemoryReplayStore(),
});
```

Persist delivery IDs for the documented replay window in production. The in-memory replay store is a local reference adapter.

## Local Receiver

```bash
export TNL_WEBHOOK_DEV_RECEIVER=1
export TNL_WEBHOOK_SECRET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
tnl-webhook-receiver
```

The receiver binds to loopback and refuses to start without the explicit development flag. See [webhook operations](../../docs/webhook-operations.md) for signing, retry, storage, alerting, rollout, and rollback contracts.

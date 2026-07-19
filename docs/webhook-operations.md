# Webhook Operations

## Service Boundary

TNL publication writes a webhook event into the same durable transaction as the intelligence revision. It never calls a subscriber inline. A relay leases committed outbox rows, a tenant-fair queue accepts the immutable event snapshot, and delivery workers create one stable delivery per event/subscription pair.

The repository includes production interfaces and deterministic in-memory reference adapters. A production deployment must inject:

- a transactional `OutboxStore` in the TNL publication database;
- a durable tenant-fair `EventQueue`;
- a durable `SubscriptionStore` and `DeliveryStore` with bounded retention;
- a KMS-backed `SecretProtector` with a documented rotation procedure;
- the system resolver plus `PinnedHttpDeliveryTransport` or an equivalent address-pinned egress proxy;
- authenticated tenant identity and separate operator replay authorization.

The bundled `tnl-webhook-service` uses header identity and in-memory stores. It refuses `NODE_ENV=production` and is only a local contract lab.

## Contract And Signing

Canonical schema: `schemas/webhooks/v1/envelope.schema.json`.

| Header                   | Meaning                                                |
| ------------------------ | ------------------------------------------------------ |
| `TNL-Webhook-Id`         | Stable idempotency key for the event/subscription pair |
| `TNL-Webhook-Timestamp`  | Unix seconds included in the signature                 |
| `TNL-Webhook-Key-Id`     | Selects the current or overlapping rotated key         |
| `TNL-Webhook-Signature`  | `v1=<HMAC-SHA256>`                                     |
| `TNL-Webhook-Attempt-Id` | Unique send attempt, including replay attempts         |
| `TNL-Event-Type`         | Routing convenience; the body remains authoritative    |
| `TNL-Event-Version`      | Envelope schema version                                |

The signature input is `v1.<timestamp>.<delivery-id>.<raw-body>`. Consumers must compare in constant time, reject timestamps outside five minutes, and claim delivery IDs atomically before side effects. A retry uses the same delivery ID and a new attempt ID; duplicate receivers should return a successful idempotent response without repeating work.

## Endpoint Policy

- Production endpoints require HTTPS and port 443.
- URLs containing credentials or fragments are rejected.
- DNS is checked at creation and again for every send.
- Delivery pins the approved IP into the HTTP connection while retaining the original hostname for TLS SNI.
- Loopback, private, link-local, carrier-grade NAT, multicast, documentation, and metadata address ranges are blocked.
- Redirects are not followed. A `3xx` response is terminal.
- Local HTTP is permitted only with an explicit loopback-only development policy.

## Retry Contract

Default maximum attempts: 8. Default request timeout: 10 seconds. Exponential delay starts at 5 seconds and caps at 1 hour with bounded jitter. `Retry-After` is honored for `408`, `425`, `429`, and `5xx` responses but capped at 1 hour.

| Result                                              | Action                                                   |
| --------------------------------------------------- | -------------------------------------------------------- |
| `2xx`                                               | Mark succeeded                                           |
| `408`, `425`, `429`, `5xx`, DNS/connect/TLS/timeout | Retry until exhausted, then dead-letter                  |
| `400`, `401`, `403`, `404`, `410`, `422`            | Terminal and disable subscription                        |
| Destination policy violation                        | Terminal, disable immediately, increment security metric |

Production values are configuration and must stay within the tested upper bounds.

## Retention And Privacy

- Event snapshots contain identifiers, revision, summary, classifications, and provenance URLs, not full article bodies.
- Delivery history contains IDs, state, attempt count, timestamps, bounded status/error codes, and latency.
- Endpoint response bodies, authorization headers, plaintext secrets, prompts, and article bodies are never retained.
- Keep detailed delivery records for 30 days, dead-letter records for 14 days after resolution, audit records for 180 days, and aggregate metrics for 13 months unless the deployed privacy policy is stricter.
- Delete subscription ciphertext immediately when a subscription is deleted. Expired overlapping keys should be compacted daily.

## Monitoring

The service exports bounded counters and gauges with the `tnl_webhook_` prefix. Page operators when any of these persist for 10 minutes:

- oldest queued event exceeds 120 seconds;
- success rate falls below 99% excluding subscriber terminal failures;
- retry rate exceeds 10%;
- dead-letter depth grows for three intervals;
- outbox reconciliation finds an unqueued committed event;
- any destination-policy violation occurs.

Readiness must fail when durable subscription, delivery, queue, KMS, or outbox dependencies are unavailable. Liveness must not depend on subscriber endpoints.

## Incident Actions

### Compromised Signing Key

1. Pause the affected subscription.
2. Rotate to a new key with no overlap.
3. Reverify the endpoint.
4. Review bounded delivery IDs and timestamps, never plaintext secret material.
5. Replay only explicitly selected failed deliveries with operator authorization.

### Queue Backlog

1. Disable subscription creation and test-event actions.
2. Keep TNL publication and outbox writes enabled.
3. Scale workers within tenant fairness limits.
4. Reconcile outbox-to-queue counts.
5. Resume relay before accepting operator replay.

### Destination Incident

Pause or disable only the affected subscription. Do not block TNL article publication or other tenants.

## Rollout And Rollback

1. Deploy durable adapters with dispatcher consumption disabled.
2. Shadow-write outbox rows and reconcile against published revisions.
3. Enable one internal signed receiver and run the canonical fixture.
4. Enable selected test tenants with strict quotas.
5. Expand by tenant while watching queue age, success, retry, and security metrics.

Rollback controls are independent: stop new subscriptions, outbox relay, fanout, or delivery workers without disabling TNL publishing. Preserve queued events for the bounded recovery window, then explicitly replay or discard them under the incident record. The producer adapter defaults to disabled.

## Local Qualification

```bash
npm run test:webhooks
npm run test:webhooks:security
npm run test:webhooks:load
```

These commands use local workspace/tarball and Python wheel artifacts. No npm, PyPI, production endpoint, or marketplace account is required.

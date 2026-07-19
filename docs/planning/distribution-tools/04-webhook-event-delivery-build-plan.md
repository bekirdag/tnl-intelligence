# TNL Intelligence Webhook and Event Delivery Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; production canary remains a deployment promotion gate
- **Progress:** [`04-webhook-event-delivery-build-progress.md`](04-webhook-event-delivery-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 01 local integration harness, Tool 03 developer onboarding and sample access
- **Unblocks:** Automation triggers, low-latency research workflows, release qualification

## Objective

Build a reliable, tenant-aware event delivery system that notifies approved consumers when TNL publishes or materially updates intelligence. Delivery must be signed, retryable, observable, replayable, and safe against endpoint abuse without copying the full TNL publishing system into this repository.

## Required Outcomes

1. A versioned event envelope shared by producers, webhooks, SDKs, and automation connectors.
2. Durable subscription and delivery state with idempotent processing.
3. HMAC-signed HTTP delivery with documented verification helpers.
4. Filters for the event and intelligence dimensions supported by TNL.
5. Backoff, dead-letter, replay, pause, and test-event controls.
6. A local receiver and failure simulator that require no published packages.
7. Bounded operational history that avoids retaining story bodies or sensitive response data.
8. Integration contracts that the TNL application can adopt without coupling its publication transaction to remote endpoints.

## Scope

### Included

- Event taxonomy and schema registry.
- Subscription CRUD contracts and authorization boundaries.
- Transactional outbox producer integration.
- Queue-backed webhook dispatcher.
- Endpoint validation and SSRF defenses.
- Signing, rotation, verification, and replay protection.
- Retry, dead-letter, replay, and delivery-history behavior.
- TypeScript and Python consumer helpers.
- Local receiver, fixture generator, and chaos scenarios.
- Metrics, traces, alerts, and operator runbooks.

### Excluded

- Publishing full article bodies to third-party endpoints by default.
- A general-purpose message broker product for external tenants.
- Social publishing, newsletter delivery, or syndication account registration.
- Marketplace publication of the automation connectors.
- Changes to TNL editorial generation or BDYA behavior.

## Architecture

```text
TNL publish/update transaction
        |
        +-- intelligence record
        +-- transactional outbox row
                    |
              outbox relay
                    |
          tenant-aware event queue
                    |
              delivery workers
             /       |       \
        endpoint   retry   dead letter
             |
       signed HTTP request
```

The application transaction writes an outbox record, not a network request. A relay promotes committed records to the delivery queue. Workers resolve subscriptions, apply filters, sign requests, and update delivery state. Each boundary must be independently retryable.

## Event Contract

### Envelope

Every event uses a stable envelope:

```json
{
  "id": "evt_...",
  "type": "intelligence.published",
  "schemaVersion": "1.0",
  "occurredAt": "2026-07-18T12:00:00Z",
  "publishedAt": "2026-07-18T12:00:02Z",
  "tenantId": "tnl_public",
  "resource": {
    "id": "story_...",
    "revision": 3,
    "url": "https://theneuralledger.com/..."
  },
  "data": {},
  "metadata": {
    "producer": "tnl",
    "traceId": "..."
  }
}
```

### Initial Event Types

- `intelligence.published`
- `intelligence.updated`
- `intelligence.retracted`
- `intelligence.impact_changed`
- `digest.weekly_published`
- `subscription.test`

### Schema Rules

- Additive fields are allowed within a schema major version.
- Removing or changing field meaning requires a new major version.
- Stable IDs, timestamps, revision, canonical URL, summary, classification, and provenance references are preferred over large bodies.
- Retractions remain addressable by stable resource ID even when public content is unavailable.
- Schemas live in source control and generate TypeScript types, Python models, fixture payloads, and documentation.
- Every example validates against the same schema used by delivery tests.

## Subscription Contract

### Subscription Fields

- Owner principal and tenant.
- HTTPS endpoint URL.
- Enabled event types.
- Optional category, geography, entity, asset, impact, confidence, and language filters.
- Active signing-key identifier and encrypted secret material.
- State: `pending`, `active`, `paused`, `disabled`, or `deleted`.
- Creation, verification, rotation, and last-delivery timestamps.

### Subscription Behavior

- New endpoints must pass validation and a challenge/test delivery before activation.
- Unsupported filter combinations fail validation instead of being silently ignored.
- Filters are evaluated against the immutable event snapshot.
- Key rotation supports an overlap window with explicit key IDs.
- A subscription can be paused automatically after terminal or sustained delivery failures.
- Deletion revokes future delivery and removes secret material according to retention policy.

## Producer Workstream

1. Define a small producer interface that accepts an event type, resource identity, revision, and normalized data.
2. Add a transactional outbox table or equivalent durable record in the TNL service boundary.
3. Enforce a uniqueness key such as `(resource_id, revision, event_type)`.
4. Store only the payload required to reproduce the event; do not duplicate complete articles unless explicitly approved.
5. Relay committed outbox records with lease-based concurrency and crash recovery.
6. Mark relay state only after the event is durably queued.
7. Add reconciliation that identifies committed records that were never queued.

## Dispatcher Workstream

1. Resolve eligible subscriptions by event type and indexed filters.
2. Partition work fairly so a noisy tenant cannot starve other subscribers.
3. Create a stable delivery ID for each event/subscription pair.
4. Send a bounded HTTP request with explicit connect, TLS, header, body, and total timeouts.
5. Treat `2xx` as success; classify retryable and terminal outcomes explicitly.
6. Honor bounded `Retry-After` values without bypassing system limits.
7. Use exponential backoff with jitter and a finite attempt schedule.
8. Move exhausted deliveries to a dead-letter state with an operator-visible reason.
9. Permit authorized replay by delivery, event, subscription, or bounded time range.
10. Preserve the original event ID and include a new attempt identifier on replay.

## Signing and Verification

### Request Headers

- `TNL-Webhook-Id`: stable delivery ID.
- `TNL-Webhook-Timestamp`: Unix timestamp used in the signature.
- `TNL-Webhook-Key-Id`: active signing-key ID.
- `TNL-Webhook-Signature`: versioned HMAC digest.
- `TNL-Event-Type`: event type for routing convenience.
- `TNL-Event-Version`: envelope schema version.

### Signature Input

Use the exact raw request body and a canonical prefix:

```text
v1.<timestamp>.<delivery-id>.<raw-body>
```

### Consumer Verification Rules

- Compare signatures in constant time.
- Reject timestamps outside the documented tolerance.
- Persist delivery IDs for at least the replay window to prevent duplicate side effects.
- Verify against the key selected by `TNL-Webhook-Key-Id`.
- Never parse and reserialize JSON before checking the signature.

### SDK Helpers

- Add TypeScript and Python verification helpers with framework-neutral raw-body inputs.
- Include examples for Node HTTP frameworks, Python ASGI/WSGI, and the local receiver.
- Test current, rotated, malformed, expired, duplicate, and tampered signatures.

## Endpoint Security

1. Require HTTPS outside explicitly marked local development.
2. Resolve and reject loopback, link-local, private, carrier-grade NAT, multicast, and cloud metadata addresses.
3. Revalidate DNS at delivery time and prevent redirect-based destination changes.
4. Disable redirects by default; any future support must re-run the complete destination policy.
5. Restrict ports and normalize internationalized hostnames before policy checks.
6. Rate-limit endpoint creation, verification, replay, and test-event actions.
7. Encrypt secrets at rest and redact them from logs, traces, errors, and support exports.
8. Never persist arbitrary endpoint response bodies; retain bounded status and diagnostic metadata only.
9. Separate operator replay authorization from normal subscription management.

## Failure and Retry Policy

| Outcome                                  | Classification               | Action                               |
| ---------------------------------------- | ---------------------------- | ------------------------------------ |
| `200-299`                                | Success                      | Complete delivery                    |
| `408`, `425`, `429`                      | Retryable                    | Backoff; honor bounded `Retry-After` |
| `500-599`                                | Retryable                    | Backoff with jitter                  |
| DNS, connect, TLS, timeout               | Retryable until limit        | Record normalized failure class      |
| `400`, `401`, `403`, `404`, `410`, `422` | Terminal or pause-triggering | Stop or pause based on policy        |
| Destination policy violation             | Terminal security failure    | Disable and alert                    |

The exact attempt schedule and retention period must be configuration, covered by tests, and documented as a service contract before production rollout.

## Delivery History and Operations

- Store event ID, delivery ID, subscription ID, attempt count, timestamps, status class, latency, and bounded error code.
- Exclude secret values, authorization headers, story bodies, and endpoint response bodies.
- Provide aggregate success rate, retry rate, dead-letter depth, time-to-deliver, and oldest queued event.
- Alert on queue age, sustained failure rates, relay reconciliation gaps, and security-policy violations.
- Add runbooks for endpoint incidents, secret compromise, queue backlog, replay, and producer rollback.
- Define retention separately for detailed attempts, aggregate metrics, and audit events.

## Local Development and Test Lab

### Local Receiver

Create an executable receiver that:

- Accepts local HTTP delivery only when an explicit development flag is set.
- Verifies signatures using the shared helper.
- Records event and attempt IDs without storing secrets.
- Can return selectable status codes or delays.
- Can simulate disconnects, invalid TLS through a test proxy, duplicate handling, and rate limiting.

### Fixture Scenarios

- Valid publish and update deliveries.
- Duplicate event and duplicate delivery attempt.
- Key rotation overlap.
- Filter match and filter exclusion.
- Slow response and connection timeout.
- `429` with valid, excessive, and malformed `Retry-After`.
- Dead-letter exhaustion and authorized replay.
- Endpoint DNS change to a prohibited address.

### Local Package Consumption

- Pack the workspace npm modules into tarballs and install them in clean receiver fixtures.
- Build Python wheels and install them into clean virtual environments.
- Do not use globally linked workspace packages for qualification evidence.
- Run the mock TNL producer, dispatcher, and receiver through the Tool 01 orchestration entrypoint.

## Test Strategy

### Unit Tests

- Schema validation and version compatibility.
- Filter compilation and matching.
- Signature creation and verification.
- Retry classification and schedule calculation.
- URL normalization and destination policy.
- State-machine transitions and idempotency keys.

### Integration Tests

- Transaction and outbox atomicity.
- Relay crash recovery and duplicate queue messages.
- Queue-to-receiver delivery with real HTTP bodies.
- Key rotation and disabled-subscription behavior.
- Replay authorization and audit records.
- Queue fairness across tenants.

### Security Tests

- SSRF payload corpus including redirects and DNS rebinding.
- Secret and body redaction assertions.
- Replay attacks outside the timestamp window.
- Cross-tenant subscription and delivery access.
- Oversized body, header, and filter inputs.

### Reliability Tests

- Worker restart during send and during state update.
- Queue outage and database outage recovery.
- Sustained endpoint failure and dead-letter growth.
- Load at expected peak plus documented headroom.

## Implementation Order

1. Freeze envelope, event taxonomy, and compatibility rules.
2. Generate language models and fixtures from schemas.
3. Implement subscription model and endpoint policy.
4. Add producer interface and transactional outbox.
5. Add relay, queue contract, and idempotent dispatcher state machine.
6. Implement signing and verification helpers.
7. Add retry, dead-letter, replay, and pause behavior.
8. Build the local receiver and chaos fixtures.
9. Add operational history, metrics, alerts, and runbooks.
10. Integrate the TNL producer behind a disabled-by-default feature flag.
11. Run local qualification, then a limited production canary.

## Validation Commands

The exact scripts will be added during implementation; the required interface is:

```bash
pnpm build
pnpm test
pnpm test:webhooks
pnpm test:webhooks:security
pnpm test:webhooks:load
pnpm artifacts:local
```

Python verification helpers must also pass the repository's isolated wheel test from Tool 01.

## Acceptance Criteria

- A committed publish event cannot be lost between the TNL transaction and the durable queue in tested failure scenarios.
- Duplicate queue messages and retries do not create duplicate consumer side effects when the documented idempotency contract is followed.
- TypeScript and Python helpers verify the same signed fixture corpus.
- Endpoint checks block the documented SSRF and redirect cases.
- Delivery attempts respect timeouts, retry limits, and tenant fairness.
- Operators can inspect, pause, rotate, dead-letter, and replay without accessing secret material.
- Local tests run entirely from built tarballs and wheels.
- The production integration remains feature-flagged and can be disabled without affecting article publication.

## Rollout and Rollback

### Rollout

1. Shadow-create outbox records without dispatch.
2. Reconcile event counts against published revisions.
3. Enable one internal receiver.
4. Enable selected test subscriptions with strict quotas.
5. Expand by tenant while monitoring delivery latency and failure classes.

### Rollback

- Disable subscription creation and dispatcher consumption independently.
- Preserve queued events for a bounded recovery window.
- Stop the outbox relay without blocking TNL publication.
- Revoke compromised signing keys and require endpoint re-verification.
- Document when queued events are replayed versus discarded after recovery.

## Completion Gate

This tool is complete only when schemas, helpers, producer integration, delivery service, local failure lab, security tests, observability, and rollback drills all pass and the limited production canary demonstrates reliable signed delivery.

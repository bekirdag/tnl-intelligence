# Tool 04: Webhook and Event Delivery Build Progress

Date: 2026-07-30
Status: Complete. The durable production service is deployed on Wodomini at
`https://hooks.theneuralledger.com` and the production canary passed end to end.
Plan: [Webhook and Event Delivery Build Plan](04-webhook-event-delivery-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                                | Status   | Evidence or next gate                                                                                        |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Event contract and schema generation      | Complete | Canonical JSON Schema deterministically generates TypeScript/Python types and signed fixtures                |
| Subscription and endpoint policy          | Complete | Tenant filters/lifecycle, encrypted secrets, challenge, rotation, deletion, and SSRF policy pass             |
| Producer outbox and relay                 | Complete | Disabled producer, unique transactional port, leases, crash recovery, reconciliation, and fair queue pass    |
| Dispatcher state machine                  | Complete | Stable idempotency, pinned HTTP, bounded retry, terminal disable, dead letter, and replay pass               |
| Signing and consumer helpers              | Complete | Exact raw-body HMAC, key IDs/overlap, time bounds, constant-time verification, and replay guards pass        |
| Local receiver and chaos lab              | Complete | Real loopback delivery plus retry, 429/5xx, terminal, duplicate, timeout policy, and DNS-change cases pass   |
| History, metrics, and operations          | Complete | Redacted bounded history, audit port, health/readiness/metrics, runbooks, retention, and rollback documented |
| Cross-language and artifact qualification | Complete | Clean event tarball and Python wheel verify the same fixture; Tool 01 container harness passes               |
| Production adapters and deployment        | Complete | PostgreSQL stores, KMS envelope secrets, TNL identity, hardened systemd unit, dedicated nginx vhost, TLS     |
| Production canary                         | Complete | 16/16 canary steps pass against the live host, including signed delivery, dead letter, replay, and restart   |

## Current Implementation Decisions

1. Tool 04 will be a private workspace service and a shared contract/helper package surface; registry publication remains out of scope.
2. The TNL publishing boundary will depend on a transactional outbox port and a disabled-by-default producer adapter, never a synchronous webhook request.
3. Local qualification will use durable in-process reference adapters and real HTTP receivers; production database, queue, KMS, and DNS resolvers remain injectable ports.
4. Event payloads carry stable intelligence identifiers, revisions, summaries, classifications, and provenance references, not full article bodies.
5. Delivery history retains bounded normalized metadata only and never endpoint response bodies, authorization material, or signing secrets.

## Validation Evidence

| Check                                  | Result | Evidence                                                                                                        |
| -------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Tools 01 and 03 prerequisites          | Pass   | Clean artifact harness and developer onboarding exit gates passed                                               |
| Repository truth and detailed plan     | Pass   | Tool 04 contract, security, reliability, operations, and rollback requirements reviewed                         |
| Impact, symbol, and DAG analysis       | Pass   | SDK/Python/MCP boundaries and generator/package changes analyzed; no unresolved imports                         |
| Contract and unit tests                | Pass   | 14 event tests cover contracts, filters, signing, lifecycle, outbox, dispatcher, control, and load              |
| Integration, security, and chaos tests | Pass   | Real raw-body receiver, retries/DLQ, DNS rebinding, tenant isolation, fail-closed bins, and 500 deliveries pass |
| Cross-language fixture parity          | Pass   | TypeScript and Python clean consumers verify `signed-published-v1.json` identically                             |
| Python quality                         | Pass   | Ruff, formatting, strict mypy, and 10 Python tests pass                                                         |
| Shared repository regression           | Pass   | Workspace validation, pack/audit, Tool 01 non-root container harness, Docdex tests, and diff checks pass        |
| Qualification evidence                 | Pass   | Private `.artifacts/tool-04/evidence.json` records four clean-artifact and security stages                      |

## Resolved Blocker History

None for repository implementation. The real production canary requires TNL
database, queue, KMS, identity, and egress deployment adapters and remains an
explicit promotion gate; it is not falsely represented by the local reference
adapters.

On 2026-07-30 this promotion gate became a verified Zapier publication blocker.
Both `weekly_edition` and `new_or_updated_intelligence` live-Zap activation
attempts failed during `performSubscribe`. Zapier reported
`getaddrinfo ENOTFOUND` for
`https://hooks.theneuralledger.com/v1/webhooks/subscriptions`. Public DNS has no
record for `hooks.theneuralledger.com`, the production host has no webhook
service listening, and nginx/systemd contain no webhook route or unit.

Public DNS was then added and independently verified through Cloudflare, Google,
and Quad9 resolvers as `95.70.192.142`. DNS is no longer the blocker. The
hostname currently presents a certificate whose SANs include only
`theneuralledger.com` and `www.theneuralledger.com`; insecure diagnostic
requests reach the main website, `/readyz` and
`/v1/webhooks/subscriptions` return `404`, and the production host still has no
webhook systemd unit, nginx virtual host, or listener.

## Production Release

| Item              | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Release commit    | `368a7879ba6987990183d51094c7739e91607f7a`                          |
| Release directory | `/srv/tnl-webhooks/releases/20260730110808-368a7879ba69`            |
| Active symlink    | `/srv/tnl-webhooks/current -> releases/20260730110808-368a7879ba69` |
| Entry point       | `/usr/bin/node /srv/tnl-webhooks/current/dist/production-bin.js`    |
| Bind address      | `127.0.0.1:7322` (loopback only, confirmed with `ss -lntp`)         |
| Public hostname   | `https://hooks.theneuralledger.com`                                 |
| Service account   | `tnlhooks` (system user, `/usr/sbin/nologin`)                       |

Supporting commits: `c20189e` (durable production adapters), `ac34a55`
(paused-subscription challenge, canary tooling, reachable Keycloak host),
`368a787` (outbox uniqueness-key encoding), `6d30285` (connector smoke-test
catalog correction).

The published `@theneuralledger/events` package stays dependency free. The
release bundle declares `pg` and `mysql2`, which the adapters resolve lazily at
runtime, so the drivers exist only in the deployment.

### Durable adapters

| Port                 | Production adapter                 | Storage                                           |
| -------------------- | ---------------------------------- | ------------------------------------------------- |
| Subscriptions        | `PostgresSubscriptionStore`        | `webhook_subscriptions`                           |
| Deliveries           | `PostgresDeliveryStore`            | `webhook_deliveries` (leased, tenant round robin) |
| Transactional outbox | `PostgresOutboxStore`              | `webhook_outbox` (unique key, lease-based relay)  |
| Event queue          | `PostgresEventQueue`               | `webhook_queue` + `webhook_queue_cursor`          |
| Secret protection    | `EnvelopeSecretProtector` over KMS | `webhook_data_keys` (wrapped data keys only)      |
| Audit                | `PostgresAuditSink`                | `webhook_audit`                                   |
| Identity             | `TnlControlAuthenticator`          | MySQL `member_api_keys` plus Keycloak realm JWKS  |
| Egress               | `PinnedHttpDeliveryTransport`      | HTTPS only, port 443, pinned validated address    |

The queue leases rather than deletes, so a crash between dequeue and fan-out
replays the event instead of dropping it. Fan-out is idempotent on the stable
delivery ID, so the replay cannot create a second delivery.

Signing secrets are sealed with a data key that exists in plaintext only inside
the service process. The data key is stored wrapped by the key-management
service, so the database alone cannot decrypt a signing secret. Rotating the
wrapping key adds a version and leaves earlier rows readable; withdrawing a
version fails closed.

### systemd unit

`/etc/systemd/system/tnl-webhooks.service`, tracked at
`deploy/webhooks/tnl-webhooks.service`. Verified state: `active` / `enabled`,
`User=tnlhooks`, `NoNewPrivileges=yes`, `ProtectSystem=strict`,
`CapabilityBoundingSet=` (empty). Also set: `ProtectHome`, `ProtectClock`,
`ProtectProc=invisible`, `PrivateTmp`, `PrivateDevices`, `LockPersonality`,
`RestrictNamespaces`, `RestrictRealtime`, `RestrictSUIDSGID`,
`RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`,
`SystemCallFilter=@system-service`, `UMask=0077`, `MemoryMax=768M`,
`TasksMax=256`.

`MemoryDenyWriteExecute` is deliberately absent: the V8 JIT needs writable
executable pages and the process trapped with `signal=TRAP` on every start until
it was removed.

Secrets live in `/etc/tnl-webhooks/env` (root:tnlhooks 0640) and the KMS keyring
in `/etc/tnl-webhooks/keyring.json` (root:tnlhooks 0640). Neither is readable by
the service user's group beyond read, and neither is in the repository.
`/etc/tnl-webhooks/config.yaml` is byte-identical to
`deploy/webhooks/config.example.yaml`.

### nginx virtual host

`/etc/nginx/sites-available/tnl-hooks.conf`, tracked at
`deploy/webhooks/nginx-hooks.conf`. Port 80 serves ACME and redirects; port 443
proxies only `/healthz`, `/readyz`, and `/v1/webhooks/` to `127.0.0.1:7322`.
`location = /metrics` returns `404` and everything else returns a structured
JSON `404`.

The main TNL site is nginx's `default_server` with `server_name ... _`, which is
why the hostname previously served website 404s. The dedicated vhost claims the
name with an exact `server_name` match. `nginx -t` reports no conflicting server
names. The TNL, MCP, auth, and developers vhosts are unchanged.

### TLS

A dedicated Let's Encrypt lineage was issued for the hostname, matching the
pattern already used by `auth`, `mcp`, and `developers` on this host, so the
main site's certificate was never rewritten:

```
sudo certbot certonly --webroot -w /var/www/html -d hooks.theneuralledger.com \
  --account b20174430f128fbb0fa59696e0503c9a --non-interactive --agree-tos
```

Verified from the public internet:

```
subject=CN=hooks.theneuralledger.com
issuer=C=US, O=Let's Encrypt, CN=YE1
notBefore=Jul 30 09:51:16 2026 GMT   notAfter=Oct 28 09:51:15 2026 GMT
X509v3 Subject Alternative Name: DNS:hooks.theneuralledger.com
```

The `theneuralledger.com` lineage was separately expanded to carry
`hooks.theneuralledger.com` as a redundant SAN. Both lineages are healthy and
`certbot renew` (without `--dry-run`) reports both as not yet due.

`certbot renew --dry-run` fails for every lineage on this host because the
staging directory has no matching account. That is not a certificate fault and
must not be treated as one.

Post-change regression, all `200`: `theneuralledger.com`,
`www.theneuralledger.com`, `mcp.theneuralledger.com/healthz`,
`developers.theneuralledger.com`. `mcp.theneuralledger.com/metrics` still `404`.

### Health and readiness

```
GET https://hooks.theneuralledger.com/healthz  -> 200
{"ok":true,"service":"tnl-webhooks"}

GET https://hooks.theneuralledger.com/readyz   -> 200
{"ready":true,"service":"tnl-webhooks",
 "dependencies":{"database":"pass","queue":"pass","kms":"pass","identity":"pass"}}
```

`/readyz` returns `503` unless all four dependencies pass. The first deployment
reported `identity: fail` and `503` because the configured JWKS host,
`auth.theneuralledger.com`, resolves to this host's own public address and NAT
loopback is not configured, so the fetch timed out. The configuration now uses
`sso.sealunit.com`, which resolves through Cloudflare and is reachable, while
both issuers remain accepted.

### Subscription canary

```
POST /v1/webhooks/subscriptions   (no credentials) -> 401
{"error":{"code":"authentication_required","message":"authentication required"}}
GET  /v1/webhooks/subscriptions   (no credentials) -> 401

POST /v1/webhooks/subscriptions   (TNL API key)    -> 201
data.subscription.id       = sub_f436468ec4bd43ae8e211d702fb4e07f
data.subscription.activeKeyId = key_viNiBfiyEy_DMg
data.secret                = present, 43 characters
data.subscription.state    = active

DELETE /v1/webhooks/subscriptions/{id}             -> 204
POST   /v1/webhooks/subscriptions/{id}/test after delete -> 404
```

The response shape is exactly what `integrations/zapier/lib/common.js` reads.
Because hosted automation platforms never call `/verify`, the signed challenge
now runs during creation, so the subscription is `active` in the create
response rather than stranded in `pending`.

Cross-tenant and cross-principal isolation, using a second API key mapped to a
different tenant: foreign `DELETE` `404`, foreign `/test` `404`, foreign list
does not contain the subscription. The tenant is resolved server side from the
authenticated principal, so an `x-tnl-tenant` request header cannot change it.

### Signed delivery and signature verification

A real `subscription.test` event was delivered over public HTTPS carrying every
required header:

```
tnl-webhook-id, tnl-webhook-timestamp, tnl-webhook-key-id,
tnl-webhook-signature, tnl-event-type, tnl-event-version,
tnl-webhook-attempt-id
```

The exact bytes of one production delivery were verified twice with the shared
helpers:

- TypeScript `verifyWebhook` -> `dlv_KS-WuPchZ9as1XVVts9DYu-npgzxYcE9`,
  `key_UI2NWEcNW1ckYw`, timestamp `1785409511`
- Python `verify_webhook` -> identical delivery ID, key ID, and timestamp

### Retry, dead letter, and replay

| Scenario                               | Result                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `429` with `Retry-After: 1`            | retried, succeeded on attempt 3, `lastStatus` 204                              |
| `500`                                  | `retry_scheduled`, `lastErrorCode` `http_500`, then `succeeded`                |
| Sustained `429`                        | `dead_letter` after 8 attempts, `lastErrorCode` `http_429`                     |
| Replay by a non-operator               | `403`                                                                          |
| Replay by an operator                  | `202`, `replayCount` 1, delivery `succeeded`                                   |
| Replay of an already accepted delivery | consumer saw a duplicate delivery ID and took no second action                 |
| Key rotation                           | new `activeKeyId`, old key listed in `previousKeyIds`, delivery still succeeds |
| Pause                                  | `/test` refused with `409`; the challenge reactivates it                       |

Delivery history is readable by the owner and never contains the signing
secret.

### Outbox, relay, and durable queue

A publish-shaped outbox row written inside a transaction was relayed into the
durable queue and fanned out to a real signed delivery:

```
firstAppend=true  duplicateAppend=false  outboxState=queued
deliveries=[{state:"succeeded", attempts:1}]
```

`duplicateAppend=false` is the uniqueness key rejecting a repeated publish of
the same `(tenant, resource, revision, type)`.

This path was broken on first run: the producer joins the uniqueness key with
NUL separators and a PostgreSQL `text` column rejects NUL, so every append
failed with `invalid byte sequence for encoding "UTF8"`. The key is now stored
base64url-encoded and decoded on read.

### Restart recovery

```
1. staged outbox event evt_restartfded4ae9f3014b, receiver returning 500
2. systemctl stop tnl-webhooks                      -> inactive
   outbox_state=queued  delivery_states=retry_scheduled  retry_scheduled_total=1
3. systemctl start tnl-webhooks                     -> active, /readyz ready
4. delivery_states_after_restart=succeeded
5. subscriptions=1  deliveries=13  data_keys=1  audit_events=21
```

No subscription, queued event, or delivery was lost across a full stop and
start, and the in-flight retry completed after the restart without being
re-staged.

### Publication isolation

With `tnl-webhooks` fully stopped:

```
theneuralledger.com : 200
TNL API /healthz    : 200
TNL MCP /healthz    : 200
hooks /healthz      : 502 (only the webhook host is affected)
```

The TNL publish path writes an outbox row and never calls the webhook service,
and `producer_enabled` is `false`, so disabling the relay or the dispatcher
cannot block article publication.

### Monitoring

`/metrics` is served only on loopback and returns `404` through the public
vhost, verified in both directions. Exposed series:
`tnl_webhook_delivery_attempted_total`, `_succeeded_total`, `_retried_total`,
`_terminal_total`, `_dead_lettered_total`, `_replayed_total`,
`destination_blocked_total`, `outbox_relayed_total`,
`tnl_webhook_queue_depth`, `tnl_webhook_oldest_queued_age_seconds`, and
`tnl_webhook_delivery_latency_p95_ms`. Queue depth combines the durable queue
and unattempted deliveries, so a stalled relay is visible. Sample during the
canary: `delivery_attempted_total 1`, `delivery_succeeded_total 1`,
`queue_depth 0`, `latency_p95_ms 429`.

External probes should use `https://hooks.theneuralledger.com/readyz`, which is
`200` only when the database, queue, KMS, and identity dependencies all pass.
Service logs are in journald under `tnl-webhooks`.

### Rollback

1. Disable delivery without redeploying: set `dispatcher_enabled: false` and
   `relay_enabled: false` in `/etc/tnl-webhooks/config.yaml`, then
   `systemctl restart tnl-webhooks`. Queued events and outbox rows are retained
   and resume when the flags are restored.
2. Roll back the code: point the symlink at the previous release and restart.
   ```
   sudo ln -sfn /srv/tnl-webhooks/releases/<previous> /srv/tnl-webhooks/current.new
   sudo mv -Tf /srv/tnl-webhooks/current.new /srv/tnl-webhooks/current
   sudo systemctl restart tnl-webhooks
   curl -s http://127.0.0.1:7322/readyz
   ```
   Releases are immutable directories under `/srv/tnl-webhooks/releases`.
3. Stop accepting new subscriptions only: remove the `/v1/webhooks/` location
   from the vhost and reload nginx. `/healthz` and `/readyz` stay up and queued
   deliveries continue.
4. Withdraw the service entirely: `sudo systemctl disable --now tnl-webhooks`.
   TNL publication is unaffected, as shown above.
5. Revoke a compromised signing key: rotate the subscription
   (`POST /v1/webhooks/subscriptions/{id}/rotate` with `overlapSeconds: 0`),
   which issues a new key ID immediately and drops the old one.
6. Roll the KMS wrapping key: add a new entry to
   `/etc/tnl-webhooks/keyring.json`, set `activeKeyId` to it, and restart. Old
   versions stay unwrappable-from-disk only while they remain in the keyring;
   removing one makes rows sealed under it fail closed by design.
7. Restore nginx or Let's Encrypt state from
   `/root/backups/nginx-20260730104918.tgz` and
   `/root/backups/letsencrypt-20260730104918.tgz`.

### Command results

| Command                                 | Result                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `npm run build`                         | exit 0, all eleven workspaces compile                  |
| `npm test`                              | exit 0, 118 tests across 13 workspaces, 0 failures     |
| `npm run test:webhooks`                 | exit 0, four qualification stages pass                 |
| `npm run test:webhooks:security`        | exit 0, 4 tests                                        |
| `npm run test:webhooks:load`            | exit 0, 1 test                                         |
| `npm run test:connector:zapier`         | exit 0, 3 tests                                        |
| `npm run test:connectors`               | exit 0 after correcting a stale smoke-test expectation |
| `docdexd hook pre-commit --repo <repo>` | exit 0                                                 |

`npm run test:connectors` failed on entry with `Zapier operation catalog
mismatch`. The cause was pre-existing: `Fix and qualify Zapier research
integration` removed `get_research_result` from the Zapier app, leaving five
creates, but the clean-tarball smoke test still asserted six. The expectation
now matches the published catalog.

### Canary artifacts and cleanup

The canary used two purpose-created TNL API keys and a receiver reachable at a
temporary path on the Cloudflare-proxied `www.theneuralledger.com`, because this
host cannot reach its own public address (no NAT loopback) and
`hooks.theneuralledger.com` is a DNS-only record. After the canary the receiver
was stopped, the temporary nginx location was removed and the vhost restored
from its pre-canary copy, the canary tenant and operator overrides were reverted
so the deployed configuration matches the tracked template byte for byte, and
both API keys were revoked. Post-cleanup regression: TNL site, `www`, MCP,
developers, and hooks all `200`.

Reproduction tooling is tracked at `scripts/webhook-canary-receiver.mjs`,
`scripts/run-webhook-production-canary.mjs`, and
`scripts/webhook-outbox-probe.mjs`.

## Current Blockers

None. The production service is live and the canary passed 16 of 16 steps with
zero failures.

Two unrelated Let's Encrypt lineages on the same host, `analytics.overrid.com`
and `fiskolay.com`, fail `certbot renew`. They are outside this workstream but
will expire without attention.

## Next Gate

1. Activate the two Zapier v1.0.3 trigger Zaps against
   `https://hooks.theneuralledger.com`, confirm `performSubscribe` succeeds now
   that the hostname serves the control API, and rerun Zapier validation.
2. Enable the TNL producer behind its feature flag so real
   `intelligence.published` and `digest.weekly_published` events reach the
   outbox, starting with a shadow window that reconciles event counts against
   published revisions.
3. Add an external uptime probe against `/readyz` and alerts on
   `tnl_webhook_oldest_queued_age_seconds` and dead-letter growth.

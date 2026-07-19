# Tool 04: Webhook and Event Delivery Build Progress

Date: 2026-07-19
Status: Repository implementation complete; production canary pending owner action
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

## Current Blockers

None for repository implementation. The real production canary requires TNL database, queue, KMS, identity, and egress deployment adapters and remains an explicit promotion gate; it is not falsely represented by the local reference adapters.

## Next Gate

Deploy the production database, queue, KMS, identity, DNS, and egress adapters,
then verify outbox recovery, signed delivery, replay, and rollback in a canary.

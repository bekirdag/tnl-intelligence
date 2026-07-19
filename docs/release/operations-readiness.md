# Operations Readiness

## Ownership

| Surface                  | Primary role                        | Secondary role             | Escalation                  |
| ------------------------ | ----------------------------------- | -------------------------- | --------------------------- |
| API, gateway, MCP        | TNL Platform Maintainer             | TNL Reliability Maintainer | Security Incident Commander |
| Research, Codali, Docdex | TNL Intelligence Maintainer         | TNL Editorial Operations   | Data Methodology Owner      |
| Webhooks and connectors  | TNL Integrations Maintainer         | TNL Platform Maintainer    | Security Incident Commander |
| SDKs, adapters, bundles  | TNL Developer Experience Maintainer | TNL Platform Maintainer    | Release Manager             |
| Quant toolkit            | TNL Data Tooling Maintainer         | Data Methodology Owner     | Release Manager             |
| Publication              | Release Manager                     | Repository Owner           | Repository Owner            |

Marketplace or registry account ownership is deliberately outside the software
candidate. A human must map these roles to current contacts in the private
incident directory before production rollout.

## Severity and Response Targets

| Severity | Example                                                                               | Acknowledge     | Stabilize target |
| -------- | ------------------------------------------------------------------------------------- | --------------- | ---------------- |
| SEV-1    | Tenant bleed, credential disclosure, corrupt point-in-time data, lost committed event | 15 minutes      | 1 hour           |
| SEV-2    | Gateway/research outage, unbounded backlog, invalid high-impact claims                | 30 minutes      | 4 hours          |
| SEV-3    | One adapter/connector unavailable with MCP/API fallback                               | 1 business day  | 3 business days  |
| SEV-4    | Documentation or non-blocking compatibility defect                                    | 2 business days | Planned release  |

## Dashboards and Alerts

The production dashboards consume the metrics already exposed by the gateway,
research, and event-delivery services. The local release gate verifies metric
names and alert rules; external dashboard provisioning remains deployment work.

| Signal                                                             | Alert                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `tnl_gateway_requests_total`, authorization failures, p95 latency  | Page on sustained 5xx above 2% or authorization anomaly above the established baseline        |
| Research provider failures, insufficient evidence, grader failures | Page on provider-wide failure; ticket on weekly grader regression                             |
| Webhook queue age, retries, dead-letter depth                      | Page when oldest committed event exceeds 15 minutes or dead-letter depth grows for 10 minutes |
| Connector/adapter contract failures                                | Ticket on any version-specific increase; page only when all generic fallbacks fail            |
| Deprecated client/version use                                      | Warn at 90 days and 30 days before the 180-day removal window                                 |
| Quant sync failures                                                | Local structured error by default; diagnostics are opt-in and credential-free                 |

## Service-Level Thresholds

- No cross-tenant object, cache, event, saved result, or credential exposure.
- No loss of a committed webhook event; retries are bounded and dead letters are
  inspectable and replayable.
- Fixture API/MCP operations complete within 5 seconds per request and fail with
  a typed timeout rather than hanging.
- Deterministic research qualification completes within 60 seconds per suite and
  preserves partial evidence when a provider is unavailable.
- The 500-delivery fairness/load test completes without starvation or unbounded
  queue growth.
- The 5,000-row quant reference workload remains below 10 seconds ingestion, 5
  seconds snapshot, 1 second feature generation, and 256 MiB peak memory on the
  recorded reference host.

## Runbook Index

1. **Credential compromise:** revoke the developer key or OAuth grant, rotate
   webhook signing material, invalidate sessions, inspect redacted audit IDs,
   and verify the next call fails.
2. **Bad artifact release:** stop promotion, restore the prior artifact index,
   revoke the bad version, run clean-profile doctor checks, and communicate the
   affected hashes.
3. **Gateway/provider degradation:** disable the failing provider flag, preserve
   TNL-only results with an explicit partial warning, and reconcile after health
   returns.
4. **Webhook backlog:** pause dispatch, preserve the outbox, correct the receiver
   or worker, resume with bounded concurrency, and replay by idempotency key.
5. **Faulty research skill/model:** disable the version, restore the prior skill
   manifest, rerun deterministic evaluations, and invalidate incompatible saved
   results only when required.
6. **Schema incompatibility:** stop the incompatible consumer, retain the old
   version through the deprecation window, then roll back or forward-fix using a
   versioned transform.
7. **Marketplace delisting:** remove only the affected listing. Generic MCP,
   REST, CLI, SDK, and local bundle paths stay available.
8. **Publication isolation:** downstream MCP, research, webhook, connector, and
   quant failures must never block the separate TNL article publication path.

Every incident records candidate ID, artifact hashes, tenant-safe request IDs,
timeline, disposition, and the recovery check that returned the surface to its
documented stable state.

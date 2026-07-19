# TNL Research Operations

This runbook covers the production boundary around `@theneuralledger/research`.
The repository ships a deterministic local service for qualification; it is not
a production identity, persistence, or secret-management implementation.

## Production Topology

```text
authenticated TNL web / remote MCP gateway
                  |
          ResearchOrchestrator
       /          |          \
TNL retrieval  remote Docdex  approved web
                  |
            Codali service
                  |
 durable tenant result store + metrics/audit
```

Deploy the orchestrator inside a TNL-owned service. The service must construct a
`ResearchRunContext` from verified tenant and actor identity, not request body
fields. The remote MCP gateway must require both `tnl:read` and `tnl:research`
for the six `tnl_research_*` tools.

## Required Production Adapters

1. **TNL retrieval:** an HTTPS endpoint backed by the current TNL story API or
   MCP capability. It must return only stories the tenant may access and retain
   story IDs, revisions, sources, claims, entities, assets, and timestamps.
2. **Docdex retrieval:** a TNL-scoped remote index endpoint. Check its documented
   health endpoint before rollout, bind the intended repo/index explicitly, and
   send bounded queries. Do not silently search an unrelated default repo.
3. **Approved web retrieval:** use the configured Docdex/mswarm discovery path or
   another approved server-side search provider. Apply domain policy, timeouts,
   quotation limits, and no-redirect behavior.
4. **Codali synthesis:** call the enhanced Codali HTTPS service/package API with
   the task, immutable skill manifest, sanitized evidence, allowed-tool list, and
   result schema. Do not shell out from the browser or copy production prompts.
5. **Durable result store:** implement `ResearchResultStore` with tenant-keyed
   authorization, encryption at rest, seven-day default retention, owner-aware
   deletion, and audit events. The in-memory adapter is test-only.

Keep endpoint credentials in the deployment secret store. Supply authorization
headers only when constructing server-side adapters. Never embed credentials in
URLs, browser JavaScript, traces, fixtures, or MCP structured output.

## Adapter Contract

Evidence endpoints receive a JSON object containing `task` and `tool` and return:

```json
{ "evidence": [] }
```

Every evidence record must match `RawEvidence`. Codali receives the task, skill,
sanitized evidence, an empty downstream tool allowlist, and the named
`tnl.research.result.v1` output schema. It returns a `SynthesisDraft`; the TNL
service constructs and grades the final result. Redirects are rejected and only
HTTPS is accepted outside explicit loopback development.

## Budgets and Source Policy

- Default: 12 tool calls, 45 seconds, 24,000 input tokens, 4,000 output tokens,
  20 sources, and USD 0.25.
- Hard maximum: 60 tool calls, 180 seconds, 120,000 input tokens, 20,000 output
  tokens, 80 sources, and USD 2.00.
- The server clamps requested budgets to the immutable skill maximum.
- Event validation requires a primary source. Weekly consequence review requires
  at least three independent publishers.
- Source allow/deny domains and freshness are part of the task cache key.
- Recent-window tasks bypass result cache. Historical complete results may use the
  tenant-scoped cache. Revision/retraction events call `invalidateResource`.

## Safety and Privacy

- Treat every source body as untrusted data. Prompt-like instructions are tagged,
  removed from the Codali capsule, retained only as bounded audit metadata, and
  may not support a claim.
- Do not persist hidden chain-of-thought. Trace stages contain tool names,
  duration, provider/version, counts, and concise decision summaries only.
- Redact credentials and personal data from dependency errors, audit events, and
  evaluation artifacts.
- Egress is limited to configured TNL, Docdex, web-discovery, and Codali endpoints.
- TNL output is identified as `TNL Bot`; it must not claim human reporting or
  produce buy/sell/order instructions.
- The service must not load BDYA configuration, prompts, queues, credentials, or
  schedules. A shared infrastructure change requires a separate BDYA regression.

## Signals and Alerts

Export request, run, failure, cancellation, completion-reason, tool-latency,
budget, source-count, cache, and grader metrics. Do not use unbounded tenant,
question, URL, or claim text as metric labels.

Alert on:

- readiness failure for TNL, Docdex, durable storage, or Codali;
- more than 5% failed runs over 15 minutes;
- more than 15% `insufficient_evidence` for a normally healthy skill;
- citation or safety grader failures above zero;
- p95 run duration above the configured budget;
- unusual cost or source growth;
- revision events that fail to invalidate affected cache entries.

## Rollout

1. Run `npm run test:research` and `npm run validate`.
2. Deploy with live adapters disabled and verify `/healthz`, `/readyz`, metrics,
   identity rejection, and no secret exposure.
3. Enable TNL and Docdex for an internal tenant. Compare deterministic and live
   contract output without publishing it.
4. Enable approved web retrieval with strict domain and budget policy.
5. Enable Codali for internal tenants and run all six versioned evaluation cases,
   including contradiction, stale, retracted, insufficient, injection, and
   budget exhaustion.
6. Enable the remote MCP tools for principals with `tnl:research`, then enable the
   standalone UI. Confirm cross-tenant read/delete tests against durable storage.
7. Start at 1% of eligible research traffic, then 10%, 25%, 50%, and 100% only
   while grader, failure, latency, and cost gates remain healthy.
8. Enable the weekly publishing handoff only after editorial-format validation.
   Research completion may emit Tool 04 events, but production publishing remains
   owned by the TNL article service.

## Rollback

Remove `tnl:research` entitlement or disable the research runner to make the six
tools disappear without affecting the eight base MCP tools. Disable Codali first
to retain evidence-only partial output, then disable web/Docdex if a dependency is
unsafe. Roll back the application image, keep schema `1.0` readers available for
stored results, invalidate affected caches, and retain bounded audit evidence.

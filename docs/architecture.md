# Architecture

TNL Intelligence is a set of read-only adapters over The Neural Ledger `/v1` API.

```text
TNL API + OpenAPI snapshot
          |
    TypeScript SDK
     /          \
MCP server    CLI/daemon
    |
Hosted OAuth/policy gateway

Static sample API + developer console

Transactional outbox -> tenant-fair event queue -> signed webhook delivery

TNL API + OpenAPI snapshot
          |
      Python SDK

TNL / remote Docdex / approved web -> bounded research orchestrator -> Codali
                                             |
                               graders + MCP App + research UI

Cursor plugin + OpenAI plugin -> shared adapter contracts -> hosted MCP gateway

TNL SDK + signed event verifier -> shared connector contracts
                                      |       |       |
                                     n8n  Pipedream Zapier

TNL Python SDK -> immutable revision lake -> point-in-time snapshots
                                              |       |       |
                                           Arrow   Polars  DuckDB
                                              |
                                   features + event studies + notebooks
```

The TypeScript SDK owns authentication, request mapping, pagination, retries, timeouts, and error normalization. MCP and CLI depend on it. The Python package implements the same public API concepts independently so Python installations do not require Node.js.

The MCP server exposes read-only tools, resources, and prompts. Stdio is intended
for local clients. Its basic Streamable HTTP server is stateless and binds to
loopback by default; each request can provide its own TNL member key as a bearer
token.

The separate hosted gateway is the multi-tenant OAuth resource server. It
introspects audience-bound external access tokens, resolves one TNL tenant and
entitlement, filters tools by scope, applies distributed quotas and emergency
disable policy, and exchanges the decision for a short-lived TNL capability. It
never passes the client OAuth token to TNL. TLS terminates at production ingress;
the gateway validates trusted HTTPS forwarding and rejects static production
identity or upstream credentials.

The research package owns versioned task/result contracts, immutable skill
manifests, source normalization, tool/time/token/source/cost budgets, tenant cache
keys, synthesis boundaries, deterministic graders, saved-result authorization,
and the standalone research UI. The MCP package registers its six research tools
and UI resource only when a `TnlResearchRunner` is provided; the eight base tools
remain unchanged otherwise. Production TNL, Docdex, web, Codali, identity, and
durable-storage implementations remain server-side adapters. This prevents client
integrations from copying prompts or gaining credential access and keeps the
research workload isolated from BDYA.

The adapter package maps six stable host-neutral workflows to the same Tool 05
task and result contracts. Generated Cursor and OpenAI bundles contain only
skills, commands, presentation guidance, and MCP connection metadata. The hosted
gateway creates a research runner after OAuth identity and tenant resolution,
then forwards a service-authenticated, tenant-bound request to the internal
research service. Vendor bundles never receive the internal service credential
or implement retrieval and Codali orchestration.

The connector package owns six host-neutral operation contracts, normalized
outputs, polling state, subscription lifecycle, research delegation, and exact
raw-body event verification. Pipedream consumes this package directly. Current
n8n Cloud policy prohibits runtime dependencies and Zapier validates in an
isolated build directory, so those release candidates carry self-contained host
runtimes tested against the same generated parity catalog and fixtures. They do
not copy Tool 05 retrieval or Codali orchestration; research calls remain bounded
requests to the internal research service.

The optional Python quant module owns the canonical temporal model, immutable
normalized revisions, atomic cursor and snapshot promotion, deterministic
manifests, leakage sentinels, versioned event/exposure features, and event-study
alignment. Its core remains standard-library-only. Arrow, pandas, Polars,
DuckDB, YAML, and notebook engines are lazy optional extras. Synthetic fixtures
and notebooks ship in the wheel; live TNL fields and user-supplied market data do
not. Historical queries select only revisions available at `asOf`, while
hindsight mode is explicit and labeled.

The onboarding service is isolated from the live API. Its no-key routes read only
from a versioned synthetic fixture, enforce a per-client fixed-window limit, and
identify responses as `static-sample`. The developer console keeps one-time key
material in memory only. Credential persistence, identity, and creation-rate
enforcement are ports so production deployments can supply durable distributed
adapters; the included header identity and in-memory stores are development-only.

The daemon polls with `updated_since`, writes each unseen story version to an immutable JSONL stream, then atomically replaces its state file. The state keeps a bounded set of revision fingerprints. TNL remains the source of generated intelligence; local tools do not synthesize or modify stories.

Webhook publication uses a disabled-by-default producer port inside the TNL
publication transaction. The relay, fair queue, and dispatcher are independently
retryable. Every delivery revalidates and pins its approved destination address,
signs the exact raw body, and retains only bounded normalized history. Durable
database, queue, KMS, identity, and operator authorization adapters are required
for deployment; included in-memory adapters are qualification references.

TNL market quotes are contextual display values. Trading systems must pair TNL intelligence with a licensed, execution-grade market data source and their own risk controls.

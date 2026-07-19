# TNL Distribution Tools High-Level Build Plan

Date: 2026-07-19
Status: Repository implementation complete; external promotion remains owner-controlled
Repository: https://github.com/bekirdag/tnl-intelligence

Follow-on release execution is tracked in the
[TNL Intelligence GitHub and GHCR Release Plan](tnl-github-ghcr-release-plan.md).

## Goal

Develop the shared services, user-facing tools, integration adapters, and
validation infrastructure needed to make TNL intelligence useful across AI
clients, automation systems, developer workflows, and quantitative research.

This plan focuses on building and testing the tools. Publishing npm or PyPI
packages, creating marketplace accounts, submitting listings, and completing
external marketplace reviews are outside scope.

## Planning Assumptions

1. The TypeScript SDK, MCP package, CLI/daemon, Python SDK, container, OpenAPI
   snapshot, and release automation are implementation-ready foundations.
2. npm and PyPI publication may remain unavailable throughout development. No
   tool may depend on downloading an unpublished TNL package from a public
   registry.
3. JavaScript packages may be consumed from npm workspaces or locally generated
   package tarballs. Python packages may be consumed through editable installs or
   locally built wheels.
4. Local containers and mock TNL API servers may be used for deterministic tests.
   Bounded live smoke tests may use a user-provided TNL API key without storing or
   logging it.
5. All tools remain read-only intelligence and research surfaces. Broker access,
   order execution, trading recommendations, and trading-grade quote distribution
   are not part of this plan.
6. Marketplace-specific projects must reuse shared contracts and services. They
   must not implement separate search, citation, authentication, webhook, or
   research logic.

## Existing Foundation

| Foundation       | Current capability                                                                    | How later tools use it                                        |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| TypeScript SDK   | Typed TNL client, pagination, retries, errors, and rate metadata                      | Remote gateway, connectors, examples, and integration tests   |
| MCP package      | Eight read-only tools, resources, prompts, stdio, and guarded Streamable HTTP         | Remote MCP, AI plugins, desktop clients, and Docker           |
| CLI/daemon       | Search/watch commands, revision-aware local event cache, and foreground service modes | Local evaluation, scheduled workflows, and smoke tests        |
| Python SDK       | Sync/async clients, typed models, cursor iteration, and errors                        | Quant toolkit, notebooks, and data workflows                  |
| OpenAPI snapshot | Versioned API contract and generated types                                            | Documentation, Postman, connector schemas, and contract tests |
| Container        | Non-root MCP/daemon image with health checks                                          | Local integration tests and hosted deployment qualification   |

## Local Package Development and Testing

Public registries are not required for any build phase.

### TypeScript packages

- Use npm workspaces for development inside this repository.
- Build SDK before MCP and CLI, following the existing dependency DAG.
- For clean consumer tests, generate package tarballs with `npm pack` and install
  the tarballs into temporary projects. Prefer tarball installation over
  `npm link`, because tarballs reproduce published package boundaries and file
  allowlists more accurately.
- Run tests once against workspace sources and once against packed artifacts for
  changes that affect exports, binaries, package metadata, or runtime resolution.

Representative local flow:

```bash
npm ci
npm run validate
npm run pack:check
npm pack --workspace @theneuralledger/sdk
npm pack --workspace @theneuralledger/mcp
npm pack --workspace @theneuralledger/cli
```

### Python package

- Use an editable install for fast development:

  ```bash
  python3 -m venv .venv
  .venv/bin/pip install -e 'python/tnl_intelligence[dev]'
  ```

- Build a wheel and source distribution for clean consumer tests:

  ```bash
  .venv/bin/python -m build python/tnl_intelligence
  ```

- Install the generated wheel into a separate temporary virtual environment
  before accepting packaging, import, optional-extra, or notebook changes.

### MCP, HTTP, and container tests

- Run MCP stdio clients directly against the local package or packed tarball.
- Run Streamable HTTP tests against loopback with a mock upstream TNL server.
- Build the container locally and test health, authentication rejection, MCP
  initialization, and representative tool calls.
- Use a bounded live TNL smoke test only after deterministic tests pass.

## Target Architecture

```text
                         TNL API and OpenAPI
                                  |
                 +----------------+----------------+
                 |                                 |
          TypeScript SDK                       Python SDK
                 |                                 |
      +----------+-----------+                     +----------+
      |          |           |                                |
 Remote MCP   Webhook     Connector core                 Quant toolkit
 gateway      contracts       |                              |
      |          |        +---+--------+                Notebooks/templates
      |      Event service |            |
      |                    n8n       Pipedream/Zapier
      |
 Shared research skills and MCP Apps UI
      |
 Cursor plugin, ChatGPT/Codex plugin, MCP clients, research app
```

The local packages remain protocol and client foundations. Multi-user identity,
entitlements, key exchange, webhook production, and account data remain
server-side capabilities and must never expose internal TNL credentials to
clients or marketplace bundles.

## Detailed Tool Build Plans

The high-level phases below are implemented through these canonical child plans.
Repository completion means source, tests, local artifacts, and the documented
exit gate are present and reproducible. It does not mean an external service was
deployed, an owner key was used, an account was registered, or a marketplace
approved a listing.

| Tool                                      | Detailed build plan                                                                                                                                | Depends on                                                | Repository | External promotion |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- | ------------------ |
| 01 Local integration harness              | [`distribution-tools/01-local-integration-harness-build-plan.md`](distribution-tools/01-local-integration-harness-build-plan.md)                   | Existing SDK, MCP, CLI, Python, and container foundations | Complete   | Not applicable     |
| 02 Remote MCP gateway                     | [`distribution-tools/02-remote-mcp-gateway-build-plan.md`](distribution-tools/02-remote-mcp-gateway-build-plan.md)                                 | Tool 01                                                   | Complete   | Pending owner      |
| 03 Developer onboarding and sample access | [`distribution-tools/03-developer-onboarding-sample-access-build-plan.md`](distribution-tools/03-developer-onboarding-sample-access-build-plan.md) | Tool 01; integrates with Tool 02 identity                 | Complete   | Pending owner      |
| 04 Webhook and event delivery             | [`distribution-tools/04-webhook-event-delivery-build-plan.md`](distribution-tools/04-webhook-event-delivery-build-plan.md)                         | Tools 01 and 03                                           | Complete   | Pending owner      |
| 05 Research skills and app                | [`distribution-tools/05-research-skills-app-build-plan.md`](distribution-tools/05-research-skills-app-build-plan.md)                               | Tools 01, 02, and 03                                      | Complete   | Pending owner      |
| 06 MCP installation artifacts             | [`distribution-tools/06-mcp-installation-artifacts-build-plan.md`](distribution-tools/06-mcp-installation-artifacts-build-plan.md)                 | Tools 01, 02, and 03                                      | Complete   | Pending owner      |
| 07 AI client adapters                     | [`distribution-tools/07-ai-client-adapters-build-plan.md`](distribution-tools/07-ai-client-adapters-build-plan.md)                                 | Tools 02, 05, and 06                                      | Complete   | Pending owner      |
| 08 Automation connectors                  | [`distribution-tools/08-automation-connectors-build-plan.md`](distribution-tools/08-automation-connectors-build-plan.md)                           | Tools 01, 03, and 04                                      | Complete   | Pending owner      |
| 09 Quantitative research toolkit          | [`distribution-tools/09-quant-research-toolkit-build-plan.md`](distribution-tools/09-quant-research-toolkit-build-plan.md)                         | Tools 01, 03, and 05                                      | Complete   | Pending owner      |
| 10 Cross-tool qualification               | [`distribution-tools/10-cross-tool-qualification-build-plan.md`](distribution-tools/10-cross-tool-qualification-build-plan.md)                     | Tools 01-09                                               | Complete   | Pending owner      |

## Dependency Order

1. Local integration harness and shared contracts.
2. Production-capable remote MCP gateway.
3. Developer onboarding, sample access, and public API experience.
4. Webhook and event-delivery service.
5. Shared research skills and research UI components.
6. One-click MCP distribution artifacts.
7. Cursor and ChatGPT/Codex adapters.
8. n8n and Pipedream connectors, followed by Zapier.
9. Quantitative toolkit and notebook templates.
10. Cross-tool operability, security qualification, and release candidates.

Each phase must pass its exit gate before dependent marketplace adapters begin.

## Phase 0: Local Integration Harness

Build the common test environment used by every later tool.

### Deliverables

- Mock TNL HTTP server with fixtures for success, pagination, revisions, empty
  results, authentication failure, quota failure, rate limiting, and upstream
  timeout.
- Temporary-consumer test projects that install local npm tarballs and Python
  wheels rather than importing repository internals.
- MCP protocol test client covering initialization, tool discovery, resources,
  prompts, and representative calls over stdio and Streamable HTTP.
- Container smoke-test runner and secret-pattern checks.
- Versioned example outputs that preserve story IDs, source links, timestamps,
  revision fields, and citations.

### Exit Gate

All existing packages can be built and consumed locally from clean environments,
and the full tool chain can be tested without npm, PyPI, marketplace accounts, or
production credentials.

## Phase 1: Hosted Remote MCP Gateway

Turn the existing local HTTP MCP transport into a production multi-user service.

### Deliverables

- Stable HTTPS Streamable HTTP endpoint backed by the existing MCP package.
- OAuth 2.1/OIDC protected-resource integration with an external authorization
  server, plus scoped API-key support for server-to-server clients. The
  authorization server owns authorization, callbacks, PKCE, refresh, and logout;
  the gateway owns resource metadata and access-token enforcement.
- Server-side exchange from external user identity to least-privilege TNL access;
  internal keys are never returned to the browser, client, logs, or MCP output.
- Per-user scopes, quotas, revocation, request IDs, audit events, bounded logs,
  rate limits, and abuse controls.
- `/healthz`, readiness, dependency health, status reporting, metrics, tracing,
  and structured secret-safe errors.
- Accurate MCP tool annotations, authentication metadata, support links, and
  privacy/retention behavior.

### Exit Gate

A clean MCP client can authenticate, call every read-only tool, revoke access,
and receive useful errors. Load, isolation, quota, credential-leak, and failover
tests pass before any hosted AI-client adapter is built.

## Phase 2: Developer Onboarding and Public API Experience

Build a self-service evaluation path that does not require marketplace-specific
setup.

### Deliverables

- Developer-key creation, rotation, revocation, scope, quota, and usage surfaces.
- Bounded sample tier with clear limits and licensing.
- Small no-key static demonstration dataset for schema and UI evaluation.
- Canonical hosted OpenAPI document and interactive browser explorer.
- Generated TypeScript, Python, `curl`, and MCP quick starts.
- Postman collection, public-safe environment template, examples, and contract
  tests generated from the canonical OpenAPI source.
- Error, pagination, timestamp, revision, rate-limit, and attribution guidance.

### Exit Gate

A new developer can reach a successful result from documentation alone without
receiving a private package or production credential from a maintainer.

## Phase 3: Webhook and Event-Delivery Service

Create the shared trigger system required by automation products.

### Deliverables

- Four versioned event types for publish, update, retract, and impact change.
  Material revisions plus asset/entity/category changes are carried as typed
  fields in the update envelope rather than multiplying semantic event names.
- Subscription filters for category, geography, entity, asset, impact, confidence,
  and event type.
- HMAC signing, key rotation, timestamps, replay protection, idempotency keys,
  retries with backoff, dead-letter handling, and bounded retention.
- Delivery history, manual replay, test events, disable/pause controls, and
  observable failure reasons.
- TypeScript/Python verification helpers and shared fixtures for connector tests.

### Exit Gate

Contract tests prove stable ordering, deduplication, retries, signature
verification, replay, unsubscribe behavior, tenant isolation, and recovery after
receiver downtime.

## Phase 4: Shared Research Skills and Research App

Build the differentiated intelligence experience once and reuse it everywhere.

### Deliverables

- Six versioned research skills: what-changed analysis, evidence comparison,
  event validation, asset/entity exposure, geopolitical and operational risk,
  and weekly consequential developments. Causal impact paths are an explicit
  output of exposure/risk skills, while every skill uses the shared cited
  briefing result contract; neither requires a separate reasoning fork.
- Shared response contract that separates source facts, TNL analysis, uncertainty,
  contradictions, and inference.
- Research application components for story timelines, evidence/source views,
  related developments, entity/asset matrices, impact paths, and citation export.
- MCP Apps-compatible UI components where supported, with a plain structured-text
  fallback for other clients.
- Evaluation set covering tool selection, citation completeness, conflicting
  evidence, empty results, stale information, and out-of-scope trading requests.

### Exit Gate

The same fixtures and expected research outcomes pass through the standalone
research app, MCP tools, and skill runner without client-specific reasoning forks.

## Phase 5: One-Click MCP Distribution Artifacts

Prepare installable artifacts while continuing to use local builds.

### Deliverables

- MCPB bundle built from a locally packed MCP package.
- Generated VS Code install URL and inspectable manual configuration.
- Tested Cursor MCP configuration with secret placeholders.
- Docker MCP Catalog-compatible manifest and local Docker MCP profile.
- Installation metadata generator that keeps versions, commands, environment
  variables, repository links, and descriptions aligned with `server.json`.
- Clean-profile smoke tests for supported desktop and IDE clients.

### Exit Gate

Every artifact installs from a local tarball, bundle, or image and completes an
authenticated tool call without relying on npm/PyPI publication.

## Phase 6: AI Client Adapters

### Cursor plugin

- Bundle the tested MCP configuration, research skills, rules, and commands.
- Provide company, asset, event, source-comparison, and weekly-brief workflows.
- Keep authentication user-supplied and secret-safe.
- Test installation, upgrade, removal, missing-key, quota, and no-result behavior
  in a clean Cursor profile.

### ChatGPT/Codex plugin

- Point to the hosted remote MCP gateway rather than the local stdio process.
- Package the shared skills and optional MCP Apps research UI.
- Maintain accurate read-only/open-world/destructive annotations.
- Create positive and negative evaluation cases, reviewer-safe demo access, and
  domain-verification assets without performing marketplace submission.

### Exit Gate

Both adapters pass the shared research evaluation set and expose no duplicated
business logic, credentials, unpublished internal endpoints, or unsupported
claims.

## Phase 7: Automation Connectors

Build a shared connector contract first, then thin platform adapters.

### Shared connector core

- Normalize authentication, pagination, filters, story/revision outputs, webhook
  verification, retries, errors, and sample data.
- Define the standard trigger: new or revised story matching saved filters.
- Define standard actions: search stories, get story, get related stories,
  resolve entity/asset, retrieve impact paths, and create a cited brief.

### n8n

- Build credentials, trigger, and actions using n8n request helpers and current
  verified-node constraints.
- Test locally with the development runner and local TNL package/API fixtures.
- Produce provenance-ready source and package artifacts without publishing them.

### Pipedream

- Build the TNL app definition, managed authentication, webhook source, actions,
  static sample events, and registry-compatible tests.
- Validate privately/local-first before preparing contribution files.

### Zapier

- Start only after the webhook contract is stable and n8n/Pipedream have proven
  the trigger/action model.
- Build authentication, webhook lifecycle, triggers, searches, actions, sample
  data, and automated tests without submitting the integration.

### Exit Gate

Equivalent workflows produce compatible outputs across n8n and Pipedream. Zapier
then passes the same contract suite without platform-specific changes to TNL
business logic.

## Phase 8: Quantitative Research Toolkit

### Deliverables

- Optional pandas and Polars conversion helpers.
- Parquet and DuckDB cache with schema/version metadata.
- Point-in-time fields distinguishing event occurrence, TNL publication, source
  availability, and revision availability.
- Entity, asset, ticker, geography, and category normalization helpers.
- Event-window, revision-history, and source-quality utilities.
- Jupyter/Colab notebooks for event studies, asset-impact timelines,
  source-quality analysis, and weekly intelligence summaries.
- Explicit look-ahead-bias checks and no broker/order-execution features.

### Exit Gate

Notebooks run from a clean environment using a locally built wheel and sample
dataset, reproduce expected outputs, and fail when a test attempts to use future
publication or revision data.

## Phase 9: Cross-Tool Qualification

### Deliverables

- One compatibility matrix for package versions, API contract, MCP protocol,
  webhook schema, skills, and connector versions.
- End-to-end tests from event creation through webhook delivery, connector
  execution, MCP research, citations, and quant ingestion.
- Load, latency, quota, retry-storm, credential rotation, tenant-isolation,
  retention, backup/restore, and dependency-outage tests.
- Central metrics for first success, active integration, tool calls, delivery
  success, errors, latency, and cost without collecting secret or story content.
- Rollback switches for remote MCP, webhooks, each adapter, research UI, and
  optional quant features.

### Exit Gate

Each tool can be enabled, upgraded, disabled, and rolled back independently.
Local artifact tests and bounded live smoke tests pass, and no planned tool
requires public npm/PyPI availability to demonstrate correctness.

## Proposed Repository Boundaries

Use existing patterns where possible; finalize exact paths during phase design.

```text
packages/
  sdk/                  existing TypeScript API client
  mcp/                  existing MCP implementation
  cli/                  existing CLI and daemon
  events/               shared event schemas and verification helpers
  research-skills/      portable skills and evaluation fixtures
  connector-core/       common connector contracts and transformations
apps/
  mcp-gateway/          hosted authentication and remote MCP edge
  research/             research UI and MCP Apps-compatible components
integrations/
  cursor/
  n8n/
  pipedream/
  zapier/
python/
  tnl_intelligence/     existing Python SDK plus optional quant modules
examples/
  notebooks/
  postman/
  mcp-clients/
test/
  fixtures/
  consumers/
  end-to-end/
```

Production identity, entitlements, key issuance, webhook delivery, and account
data may require changes in the main TNL application or a separately deployed
service. Keep their public contracts and local test doubles in this repository;
do not copy production user/account logic into marketplace adapters.

## Milestones

| Milestone                  | Tool outcome                                                      | Depends on        |
| -------------------------- | ----------------------------------------------------------------- | ----------------- |
| M1 Local-first foundation  | Clean local package consumption and shared integration harness    | Existing packages |
| M2 Hosted platform         | Remote MCP, onboarding, sample tier, docs, and webhook delivery   | M1                |
| M3 Research experience     | Shared skills, evaluation set, research UI, and install artifacts | M2                |
| M4 AI adapters             | Cursor and ChatGPT/Codex release candidates                       | M3                |
| M5 Automation              | Connector core, n8n, Pipedream, then Zapier candidates            | M2 and M3         |
| M6 Quant and qualification | Quant toolkit, notebooks, end-to-end qualification, and rollback  | M1-M5             |

Milestones produce locally testable release candidates. They do not include npm,
PyPI, marketplace, or directory publication.

## Validation Strategy

1. Unit tests for transformations, authentication decisions, signatures, filters,
   annotations, and research response contracts.
2. Contract tests against the vendored OpenAPI schema, MCP protocol, webhook
   schemas, skills, and connector fixtures.
3. Integration tests with mock upstreams and locally built packages.
4. Clean-consumer tests using npm tarballs, Python wheels, MCPB bundles, and local
   container images.
5. End-to-end tests across remote MCP, events, connectors, research UI, and quant
   ingestion.
6. Bounded live smoke tests using secret-safe runtime injection only after all
   deterministic checks pass.
7. Docdex impact analysis, dependency diagnostics, full test runner, pre-commit
   validation, and recorded evidence before each milestone is marked complete.

## Non-Goals

- Publishing npm, PyPI, MCP Registry, container, marketplace, or directory
  listings as part of tool development.
- Creating marketplace accounts before an artifact reaches its local exit gate.
- Building a rich VS Code extension before the shared research UI proves an
  editor-specific need.
- Building Make, browser, Google Sheets, or enterprise data products before n8n,
  Pipedream, Cursor, and ChatGPT/Codex validate the shared contracts.
- Reimplementing TNL story generation, Codali research orchestration, identity,
  or entitlement logic inside third-party adapters.
- Trading execution, broker credentials, automatic trading decisions, or
  redistribution of source content beyond TNL's licensing rights.

## Plan Completion Criteria

The tool-development program is complete when:

1. Every milestone has a locally installable release candidate and recorded test
   evidence.
2. Hosted components pass authentication, isolation, observability, reliability,
   privacy, and rollback gates.
3. AI adapters share one research contract and evaluation set.
4. Automation adapters share one event and action contract.
5. Quant tools preserve point-in-time correctness and prevent look-ahead bias.
6. npm and PyPI packages remain replaceable by local workspaces, tarballs, and
   wheels throughout testing.
7. Publication is a separate owner-controlled operation after tool completion.

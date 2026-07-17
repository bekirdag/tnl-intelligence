# TNL Intelligence Developer Tools Build Plan

Date: 2026-07-17
Repository: https://github.com/bekirdag/tnl-intelligence

## Goal

Deliver a publish-ready, open-source developer toolkit that exposes The Neural Ledger's source-linked intelligence to AI agents, Node.js applications, and Python quantitative workflows without adding broker execution or presenting TNL market quotes as trading-grade price data.

## Product Surfaces

1. `@theneuralledger/sdk`: typed TypeScript client for the authenticated TNL `/v1` API.
2. `@theneuralledger/mcp`: read-only MCP server with stdio and Streamable HTTP transports.
3. `@theneuralledger/cli`: `tnl` command, local event cache, watch mode, and foreground daemon.
4. `tnl-intelligence`: synchronous and asynchronous Python SDK for research and trading-system integration.
5. Container and registry metadata for self-hosted MCP deployments.

## Architecture

```text
TNL /v1 API and OpenAPI contract
             |
       TypeScript SDK
        /           \
   MCP server       CLI/daemon
       |
 stdio or Streamable HTTP

TNL /v1 API and OpenAPI contract
             |
         Python SDK
```

All intelligence generation remains server-side in TNL. Local packages are typed adapters, cache managers, and protocol bridges. The HTTP MCP mode accepts a request bearer key or a server-side `TNL_API_KEY`; production multi-user OAuth is a separate TNL deployment workstream.

## Dependency Order

1. Repository conventions, shared TypeScript configuration, workspace scripts, and vendored OpenAPI snapshot.
2. TypeScript SDK models, client, error handling, pagination, and tests.
3. MCP server built on the TypeScript SDK.
4. CLI and daemon built on the TypeScript SDK and MCP package.
5. Python SDK aligned to the same OpenAPI surface.
6. Docker, MCP Registry metadata, examples, CI, release workflows, and publication handoff.

This ordering follows the package dependency DAG: SDK changes can affect MCP and CLI; MCP and CLI must not become dependencies of the SDK.

## Workstream 1: Repository Foundation

- Configure npm workspaces, TypeScript project references, ESLint, Prettier, Node test runner, coverage, and package build scripts.
- Add license, contribution guide, code of conduct, security policy, changelog, and repository metadata.
- Fetch and vendor the live TNL OpenAPI document with a reproducible sync/check script.
- Add common package conventions: ESM, Node 20+ support, semantic versioning, provenance-ready package metadata, and explicit published-file allowlists.
- Keep secrets, caches, build output, virtual environments, and local daemon state out of git.

## Workstream 2: TypeScript SDK

- Implement `TnlClient` with bearer authentication, configurable base URL, timeout, bounded retries, user-agent identification, and injectable `fetch`.
- Implement typed calls for account usage, news, search, entities, impact paths, asset stories, filters, markets, saved searches, feeds, and Ledger AI Terminal.
- Support cursor pagination and async iteration.
- Preserve API response envelopes and unknown forward-compatible fields.
- Expose typed authentication, quota, rate-limit, timeout, and API errors without logging keys or response secrets.
- Add deterministic unit tests with a mocked transport.

## Workstream 3: MCP Server

- Expose a small read-only tool set:
  - `tnl_latest_news`
  - `tnl_search_news`
  - `tnl_asset_intelligence`
  - `tnl_entity_intelligence`
  - `tnl_impact_path`
  - `tnl_explain_event`
  - `tnl_deep_research`
  - `tnl_service_status`
- Return structured content plus concise human-readable summaries.
- Add story, asset, and entity resources plus reusable risk-review prompts.
- Annotate tools as read-only and avoid broker/order side effects.
- Support stdio for local AI clients and stateless Streamable HTTP for local or container deployments.
- In HTTP mode, accept per-request bearer credentials without persisting them.
- Add MCP protocol tests using the official client SDK.

## Workstream 4: CLI And Foreground Daemon

- Implement `tnl latest`, `search`, `asset`, `status`, `watch`, `daemon`, `mcp`, and `serve`.
- Resolve credentials from `TNL_API_KEY` first and an optional secure local credential provider second.
- Never accept the API key as a visible command-line argument.
- Implement an immutable JSONL event cache with atomic cursor/state files and restrictive permissions.
- Poll incrementally with `updated_since`, deduplicate identical story versions, preserve revisions, and report numbered Running/Complete stages.
- Keep the daemon in the foreground, support graceful shutdown, and leave no stale lock.
- Add command and daemon integration tests against a local mock TNL server.

## Workstream 5: Python SDK

- Publishable `pyproject.toml` using a `src` layout and `py.typed`.
- Provide synchronous and asynchronous clients using `httpx`.
- Cover primary news, search, entity, impact path, asset, filter, market, account, and Ledger AI endpoints.
- Implement typed errors, retries, timeouts, cursor iteration, and secret-safe representations.
- Test with `pytest` and `httpx.MockTransport`.

## Workstream 6: Distribution

- Add a multi-stage Dockerfile and Compose example for Streamable HTTP MCP.
- Add `server.json` for the MCP Registry with npm stdio metadata. Add the remote endpoint only after it is deployed and authenticated.
- Add VS Code, Claude Desktop/Code, generic MCP, TypeScript, and Python examples.
- Add GitHub Actions for CI, npm package dry-runs, Python builds, container builds, dependency review, and manual release workflows.
- Add release documentation for npm scope ownership, npm trusted publishing/token setup, PyPI trusted publishing, MCP Registry authentication, and container publication.

## Security Boundaries

- Read-only intelligence tools only; no broker connections or order placement.
- API keys must not be accepted as positional CLI arguments, logged, stored in daemon events, returned through MCP, or included in telemetry.
- HTTP deployments bind to loopback by default.
- Remote deployments must use TLS and an authentication layer.
- Event cache permissions are user-only where supported.
- Dependencies and built package contents are checked before release.

## Validation

- TypeScript lint, format check, build, unit tests, package-boundary checks, and package tarball inspection.
- MCP stdio protocol round trip and HTTP initialize/tool-call round trip.
- CLI exact-command smoke tests, daemon incremental sync, duplicate suppression, graceful shutdown, and lock cleanup.
- Python formatting, linting, type checking, unit tests, wheel/sdist build, and installed-wheel smoke test.
- Docker image build, non-root execution, health check, and MCP HTTP smoke test.
- Secret-pattern scan, `npm audit`, Python dependency audit where available, and Docdex pre-commit gate.
- Live read-only smoke tests may use a user-provided TNL API key, but the repository test suite must pass without secrets.

## Release Gates

1. All local validation is green.
2. Package dry-runs contain only intended files and no credentials.
3. Git commit is pushed to the public repository.
4. User confirms npm scope/package ownership and completes npm publication.
5. User configures PyPI trusted publishing or performs the first PyPI upload.
6. User authenticates `mcp-publisher` and publishes the registry metadata.
7. A hosted remote MCP URL is added only after TNL OAuth/TLS deployment passes live validation.

## Non-Goals

- Trading signals, portfolio recommendations, broker integrations, or automatic order execution.
- Trading-grade quote distribution.
- A dedicated VS Code extension in the initial release.
- A hosted multi-tenant MCP service without TNL-side OAuth.
- Package publication by the coding agent.

## Rollback

- Packages remain versioned independently and can be unpublished/deprecated according to each registry's policies.
- Registry metadata initially advertises only the local npm transport.
- HTTP mode binds locally by default and can be disabled without affecting SDK use.
- OpenAPI snapshots are versioned so generated-contract regressions can be reverted without changing the TNL service.

# Tool 01: Local Integration Harness Build Plan

Date: 2026-07-19
Status: Repository implementation complete; no external promotion applies
Progress: [Local Integration Harness Build Progress](01-local-integration-harness-build-progress.md)
Parent: [TNL Distribution Tools High-Level Build Plan](../tnl-distribution-tools-build-plan.md)
Progress: [Tool 01 Build Progress](01-local-integration-harness-build-progress.md)

## Objective

Build one deterministic, local-first integration harness that proves every TNL
package and later tool can be consumed from clean environments without npm,
PyPI, marketplace accounts, or production infrastructure.

## Required Outcomes

1. JavaScript consumers install locally packed SDK, MCP, and CLI tarballs.
2. Python consumers install a locally built wheel and source distribution.
3. MCP tests exercise stdio and Streamable HTTP through the public package
   interfaces.
4. Container tests exercise the locally built non-root image.
5. Tests cover success and failure behavior against a deterministic mock TNL API.
6. One command runs the harness, emits machine-readable evidence, and leaves no
   server, lock, secret, or temporary consumer behind.

## Scope

### Included

- Shared HTTP fixtures and a mock TNL API server.
- Clean npm-tarball and Python-wheel consumer projects.
- MCP protocol clients for stdio and Streamable HTTP.
- CLI, daemon, and container smoke tests.
- Optional bounded live smoke-test lane.
- Artifact manifests, secret scans, cleanup, and evidence reports.

### Excluded

- Public package publication.
- Marketplace installation or submission.
- Production OAuth, webhooks, research UI, connectors, or quant features.
- Performance conclusions based only on the mock server.

## Dependencies

- Existing npm workspaces: SDK -> MCP and CLI.
- Existing Python project under `python/tnl_intelligence`.
- Existing OpenAPI snapshot, MCP metadata, Dockerfile, and Compose example.
- Node, npm, Python, a local container runtime, and loopback networking.

## Proposed Structure

```text
test/
  fixtures/
    api/
    mcp/
    events/
  mock-tnl/
    server.ts
    scenarios.ts
  consumers/
    node-sdk/
    node-mcp/
    node-cli/
    python-sdk/
  protocol/
    stdio.test.ts
    http.test.ts
  container/
    smoke.test.ts
  live/
    read-only-smoke.ts
  harness/
    run.ts
    cleanup.ts
    evidence.ts
.artifacts/
  npm/
  python/
  evidence/
```

Generated `.artifacts` content remains ignored by git. Versioned fixtures and
expected response shapes remain in source control.

## Workstream 1: Fixture and Mock API Contract

1. Inventory the API calls made by the SDK, MCP tools, CLI commands, and Python
   client.
2. Create fixture factories from the vendored OpenAPI schemas rather than copying
   arbitrary production payloads.
3. Cover latest/search, story detail, related stories, entity/asset resolution,
   impact paths, account usage, and Ledger AI responses.
4. Add scenarios for cursor pagination, revisions, empty results, partial fields,
   unknown forward-compatible fields, invalid input, 401, 403, 404, 409, 429,
   500, slow response, connection reset, and malformed upstream JSON.
5. Give each scenario a stable identifier and deterministic clock/ID source.
6. Validate every success fixture against the current OpenAPI snapshot.

## Workstream 2: JavaScript Artifact Consumers

1. Build workspaces in dependency order.
2. Pack each package into `.artifacts/npm` and record filename, version, integrity
   hash, and file manifest.
3. Create temporary projects with their own `package.json` and lockfile.
4. Install tarballs by absolute path; do not import repository source paths.
5. Test ESM imports, exported types, public client creation, MCP binary startup,
   CLI binary startup, `--help`, and representative API calls.
6. Verify dependency resolution works when the temporary project has no workspace
   symlinks.
7. Inspect tarballs for secrets, build caches, tests, source maps, or undeclared
   runtime files.

Planned commands:

```bash
npm run build
npm run pack:check
npm run test:consumer:node
```

The final script names may follow repository conventions, but CI and local usage
must invoke the same entrypoints.

## Workstream 3: Python Artifact Consumer

1. Run Ruff, mypy, and pytest before building artifacts.
2. Build wheel and source distribution into `.artifacts/python`.
3. Create a temporary virtual environment with no repository path injection.
4. Install the wheel, import sync/async clients, and run representative calls
   against the mock API.
5. Install the source distribution in a second environment to catch missing build
   metadata or package files.
6. Confirm `py.typed`, package metadata, license, and optional extras are present.
7. Scan built archives for credentials, local paths, fixtures, or caches.

## Workstream 4: MCP Protocol Harness

1. Use the official MCP client SDK to launch the packed local MCP binary.
2. Test initialization, server information, tool discovery, resource templates,
   prompts, structured output, progress/error behavior, and graceful shutdown.
3. Repeat the same contract over loopback Streamable HTTP.
4. Verify missing and invalid credentials are rejected without disclosing keys or
   upstream response bodies.
5. Assert all exposed tools remain read-only and annotations match behavior.
6. Save normalized protocol transcripts with secrets and unstable IDs removed.

## Workstream 5: CLI, Daemon, and Container Harness

1. Run CLI commands from the packed binary against the mock server.
2. Start the foreground daemon, ingest initial stories, apply revisions, suppress
   duplicates, handle cursor advancement, stop cleanly, and verify lock removal.
3. Build a local container tagged with the source commit.
4. Verify non-root execution, `/healthz`, readiness, loopback/default binding,
   authentication rejection, MCP initialization, and a representative tool call.
5. Stop and remove all harness containers and networks even after a failed test.

## Workstream 6: Orchestration and Evidence

1. Add a single foreground harness command with numbered stage output.
2. Fail fast on build or contract failures while still running cleanup.
3. Write a JSON evidence report containing commit, tool versions, artifact hashes,
   tests, durations, and failure summaries without secrets.
4. Add a human-readable summary for the progress trail.
5. Make temporary roots configurable for CI and local disks.
6. Add signal handling and stale-process cleanup.

## Optional Live Smoke Lane

- Disabled unless `TNL_API_KEY` is present at runtime.
- Uses only read-only endpoints and a bounded request count.
- Never saves payloads that may contain private member data.
- Prints request IDs and pass/fail evidence, not the credential.
- Does not replace deterministic mock tests.

## Security Requirements

- Reject API keys passed as command-line arguments.
- Redact bearer tokens, cookies, authorization headers, and secret-looking query
  values from logs and evidence.
- Bind all mock and test HTTP services to loopback.
- Use restrictive permissions for daemon state and evidence containing response
  metadata.
- Prove cleanup after success, failure, timeout, and interrupt.
- Run secret-pattern scans over packages, wheels, logs, fixtures, and reports.

## Validation Matrix

| Layer            | Required validation                                                        |
| ---------------- | -------------------------------------------------------------------------- |
| Fixtures         | OpenAPI schema validation and deterministic snapshot tests                 |
| npm artifacts    | Clean install, import, binary, file-manifest, and secret scan              |
| Python artifacts | Wheel/sdist install, import, typing marker, metadata, and secret scan      |
| MCP stdio        | Initialize, discover, call, error, and shutdown                            |
| MCP HTTP         | Health, auth rejection, initialize, call, timeout, and shutdown            |
| CLI/daemon       | Commands, revisions, dedupe, cursor, permissions, signal, and lock cleanup |
| Container        | Build, non-root, health, auth, MCP call, stop, and removal                 |
| Live lane        | Bounded read-only smoke with runtime-only credential injection             |

## Implementation Order

1. Fixture schema and deterministic mock server.
2. npm artifact builder and clean Node consumer.
3. Python artifact builder and clean virtual-environment consumer.
4. MCP stdio/HTTP protocol clients.
5. CLI/daemon and container tests.
6. Foreground orchestrator, evidence, cleanup, and CI integration.

## Acceptance Criteria

- The harness passes from a clean clone after installing development toolchains.
- No test imports unpublished packages from a public registry.
- No consumer reaches into repository-private source paths.
- Every planned error scenario produces a typed, secret-safe result.
- The exact harness command leaves no processes, containers, networks, locks, or
  temporary credentials.
- Evidence identifies exactly which artifact and contract was tested.

## Rollback

- Keep the existing package tests as the authoritative fallback while the harness
  is introduced.
- Add consumers incrementally; a failing new lane must not disable existing CI.
- Version fixtures so an OpenAPI rollback can restore the prior contract set.
- Remove only generated `.artifacts` and temporary consumers during cleanup.

## Completion Gate

Tool 01 is complete when all acceptance criteria pass locally and in CI, evidence
is recorded in the main progress trail, and Tools 02-10 can depend on the harness
without public package publication.

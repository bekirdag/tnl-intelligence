# Tool 01: Local Integration Harness Build Progress

Date: 2026-07-19
Status: Repository implementation complete; no external promotion applies
Plan: [Local Integration Harness Build Plan](01-local-integration-harness-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                    | Status   | Evidence or next gate                                                                                |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Fixture and mock API contract | Complete | Deterministic auth, pagination, revision, latency, malformed response, and HTTP failure scenarios    |
| JavaScript artifact consumers | Complete | SDK, MCP, and CLI tarballs install and execute in a clean temporary consumer                         |
| Python artifact consumers     | Complete | Wheel and source archive build, install, and exercise in isolated virtual environments               |
| MCP protocol harness          | Complete | Packed stdio and Streamable HTTP initialize/list/call flows pass                                     |
| CLI and daemon harness        | Complete | Help, latest, revision, dedupe, state mode, and lock cleanup checks pass                             |
| Container harness             | Complete | Product and mock images pass isolated non-root health, auth, and tool checks with cleanup            |
| Orchestration and evidence    | Complete | Foreground runner records redacted JSON evidence, handles signals, and removes resources             |
| Optional live smoke lane      | Ready    | Disabled by default; requires runtime-only `TNL_API_KEY` and performs two bounded read-only requests |

## Current Implementation Decisions

1. The harness is additive and tests existing public package interfaces; production package internals remain unchanged unless a failing clean-consumer contract proves a defect.
2. Versioned mock fixtures live under `test/fixtures/api`, while generated artifacts and evidence live under ignored `.artifacts` directories.
3. npm packages are installed from absolute local tarball paths in a clean temporary project. Python is installed from locally built wheel and source archives in clean virtual environments.
4. The container lane uses an isolated Docker network and a dedicated mock API image so no test credential or fixture request reaches production.
5. External registry and marketplace publication remain outside Tool 01.

## Validation Evidence

| Check                            | Result        | Evidence                                                                                                         |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Repository and plan truth loaded | Pass          | Docdex tree/search/open plus profile, repo memory, diary, and clone directive reviewed                           |
| Dependency ordering              | Pass          | Tool 01 remains the prerequisite for Tools 02-10                                                                 |
| Impact analysis                  | Pass          | `package.json`, MCP HTTP, and CLI program show no graph edges; impact diagnostics report no unresolved imports   |
| AST and symbol inspection        | Tooling issue | Docdex MCP calls return `unknown or expired MCP session`; narrow indexed search/open inspection used as fallback |
| Existing regression baseline     | Pass          | Previous master evidence records 13 passing TypeScript workspace tests                                           |
| Mock contract tests              | Pass          | `npm run test:integration`; 2 tests passed                                                                       |
| Full local harness               | Pass          | `npm run test:harness`; all package, consumer, protocol, CLI, Python, and container stages passed                |
| Workspace validation             | Pass          | `npm run validate`; OpenAPI, formatting, typecheck, 13 workspace tests, and builds passed                        |
| Python validation                | Pass          | Ruff, format, strict mypy, 7 pytest cases, wheel, and source build passed                                        |
| Docdex test runner               | Pass          | `docdexd run-tests --repo .`; 13 workspace tests passed                                                          |
| Cleanup                          | Pass          | Zero harness containers, networks, mock processes, temporary roots, or retained images                           |
| Evidence integrity               | Pass          | `.artifacts/tool-01/evidence.json` is mode `0600` and records artifact hashes, durations, cleanup, and redaction |
| Optional live smoke              | Ready         | Implemented and intentionally skipped without `TNL_HARNESS_LIVE=1` and a runtime credential                      |

## Implementation Outcomes

1. `scripts/run-integration-harness.mjs` is the single foreground entry point for clean npm, Python, protocol, CLI, and container qualification.
2. `test/mock-tnl` and `test/fixtures/api` provide a stable TNL Bot contract without contacting production.
3. The Python client now raises a typed `TnlError` when a successful upstream response contains malformed JSON.
4. MCP HTTP requires request bearer authorization by default. `TNL_MCP_ALLOW_ENV_API_KEY=1` is an explicit loopback-only compatibility switch; a server-side `TNL_API_KEY` no longer authenticates remote requests implicitly.
5. Generated artifacts and evidence remain under ignored `.artifacts` storage; no registry or marketplace publication occurred.

## Current Blockers

None. The Docdex MCP session defect is recorded above; CLI search, open, impact, DAG, memory, and indexing remained available throughout qualification.

## Next Gate

No Tool 01 gate remains. Tool 10 reruns this harness when preparing each release
candidate.

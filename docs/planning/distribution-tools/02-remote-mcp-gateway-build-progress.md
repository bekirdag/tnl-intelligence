# Tool 02: Hosted Remote MCP Gateway Build Progress

Date: 2026-07-19
Status: Repository implementation complete; production deployment pending owner action
Plan: [Hosted Remote MCP Gateway Build Plan](02-remote-mcp-gateway-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                             | Status   | Evidence or next gate                                                                                                               |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Transport and protocol boundary        | Complete | Bounded stateless Streamable HTTP ingress, media/origin/TLS rules, deadlines, concurrency, and tested graceful drain                |
| OAuth/OIDC integration                 | Complete | RFC 9728 resource metadata plus mock-AS S256 PKCE, refresh rotation, RFC 7662 introspection, claim checks, and revocation rejection |
| Identity and entitlement resolution    | Complete | Canonical principal/tenant mapping, cross-tenant rejection, entitlement states, and scope intersection                              |
| Capability broker and upstream access  | Complete | External OAuth token isolation, short-lived broker adapter, tool-bound capability request, and upstream request IDs                 |
| Quotas and abuse controls              | Complete | Atomic local qualification store plus production HTTP quota and emergency-disable adapters                                          |
| Audit and observability                | Complete | Redacted audit contracts, bounded metrics, real dependency readiness, health, and request-ID propagation                            |
| Deployment and operations              | Complete | Fail-closed environment schema, non-root image, Kubernetes manifests, probes, rollback, rotation, and incident runbook              |
| Security and reliability qualification | Complete | Auth, tenant, scope, quota, revocation, origin, size, dependency, secret, and container tests                                       |

## Current Implementation Decisions

1. Hosted concerns will live in a separate `packages/gateway` workspace; local MCP stdio remains independently usable.
2. The gateway is an OAuth protected resource. The external authorization server owns authorization, callbacks, PKCE, refresh, and logout; the gateway accepts verified access tokens and injects a server-held TNL capability only after tenant, entitlement, tool-scope, and quota decisions succeed.
3. Production identity and storage integrations use explicit ports/adapters. Deterministic in-memory adapters are restricted to local tests and development mode.
4. The gateway must not log raw prompts, article bodies, OAuth tokens, or TNL credentials.
5. Registry publication and production deployment remain outside this tool's local completion gate.

## Validation Evidence

| Check                           | Result | Evidence                                                                                                                                                    |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool 01 prerequisite            | Pass   | Full clean-consumer and container harness passed                                                                                                            |
| Repository truth and plan       | Pass   | Detailed plan, MCP transport, SDK client, package topology, and current tests reviewed                                                                      |
| Impact and DAG analysis         | Pass   | MCP, gateway, config, and SDK files show no unresolved graph edges; DAG `51abeb41-e93b-4951-80f4-e27aa69db51a` exported                                     |
| Indexed symbol inspection       | Pass   | Reindexed 120 documents; Docdex search returned gateway symbols and exact source context                                                                    |
| Gateway unit and protocol tests | Pass   | Tests cover mock-AS PKCE/refresh/revocation, introspection, MCP calls, scopes, isolation, quotas, upstream outage recovery, readiness, redaction, and drain |
| Shared MCP regression           | Pass   | 5 MCP tests, including explicit tool allowlisting and denied execution                                                                                      |
| SDK request tracing             | Pass   | 6 SDK tests, including request-ID propagation and header-injection rejection                                                                                |
| Full repository validation      | Pass   | OpenAPI, Prettier, strict TypeScript, 28 workspace tests, and all builds pass                                                                               |
| Clean artifact consumers        | Pass   | Tool 01 harness passes npm tarballs, Python wheel/sdist, MCP, CLI, and daemon flows                                                                         |
| Package and dependency checks   | Pass   | Three publishable tarballs verified; high-severity npm audit reports zero vulnerabilities                                                                   |
| Docdex test runner              | Pass   | `docdexd run-tests --repo .`; 28 workspace tests passed                                                                                                     |
| Container and operations tests  | Pass   | Gateway image `d6dbe87...` built, ran non-root/read-only, rejected missing auth, and failed closed without production config                                |
| Diff hygiene                    | Pass   | `git diff --check` passed; test containers and the qualification image were removed                                                                         |

## Implementation Outcomes

1. `packages/gateway` is a separate hosted service; local stdio and loopback MCP remain independent.
2. Production uses HTTPS introspection, access, capability, quota, disable, audit, and readiness adapters. Static identities and upstream credentials are development/test-only.
3. MCP discovery contains only tools allowed by the intersection of token scopes and server-side entitlement.
4. Browser OAuth tokens never become TNL API tokens. Production exchanges a verified policy decision for a separate, bounded upstream capability.
5. Audit and metrics exclude credentials, prompts, tool arguments, story bodies, raw network identifiers, and unbounded labels.
6. `Dockerfile.gateway`, `deploy/gateway`, and `docs/gateway-operations.md` define deploy, drain, rotation, incident, and rollback boundaries.

## Current Blockers

None for implementation. A production rollout still requires owner-supplied IdP and control-plane endpoints/secrets, TLS ingress, and deployment approval.

## Next Gate

Deploy with owner-supplied IdP/control-plane endpoints, TLS ingress, and secrets,
then run the production readiness, isolation, drain, and rollback canary.

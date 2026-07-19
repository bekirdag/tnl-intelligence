# Tool 02: Hosted Remote MCP Gateway Build Plan

Date: 2026-07-19
Status: Repository implementation complete; production deployment remains an owner gate
Progress: [Hosted Remote MCP Gateway Build Progress](02-remote-mcp-gateway-build-progress.md)
Parent: [TNL Distribution Tools High-Level Build Plan](../tnl-distribution-tools-build-plan.md)
Depends on: [Tool 01 Local Integration Harness](01-local-integration-harness-build-plan.md)

## Objective

Build a production-capable, multi-user HTTPS MCP gateway that reuses the existing
read-only MCP implementation while adding identity, authorization, quotas,
credential isolation, observability, and operational controls required by hosted
AI clients.

## Required Outcomes

1. Standards-compatible Streamable HTTP MCP over TLS.
2. OAuth 2.1/OIDC protected-resource compatibility with an external authorization
   server, plus scoped server-to-server credentials.
3. Canonical mapping from external identity to TNL tenant, user, entitlement, and
   least-privilege API capability.
4. No internal TNL key exposure to clients, browsers, agents, logs, or traces.
5. Per-principal quotas, revocation, auditability, rate limits, and abuse controls.
6. Deployable service with health, readiness, metrics, tracing, and rollback.

## Scope

### Included

- Remote MCP ingress and protocol/session lifecycle.
- RFC 9728 protected-resource metadata, external authorization-server discovery,
  access-token introspection/validation, and revocation enforcement.
- Policy and entitlement enforcement.
- Short-lived internal capability/token broker.
- Quotas, rate limiting, audit events, tracing, metrics, and support diagnostics.
- Local IdP/upstream test doubles and production deployment manifests.

### Excluded

- Rewriting MCP tools or TNL research logic.
- Public directory or plugin submission.
- Marketplace-specific UI.
- Long-lived storage of raw external tokens or internal TNL credentials.
- Broker or trading execution capabilities.

## Architecture

```text
MCP client
   |
TLS ingress / request limits
   |
OAuth resource validation
   |
Principal + tenant resolver
   |
Entitlement/policy + quota decision
   |
Short-lived TNL capability broker
   |
Existing MCP server -> TypeScript SDK -> TNL API
   |
Audit, metrics, traces, bounded logs
```

The gateway may live under `apps/mcp-gateway`. The MCP business implementation
remains in `packages/mcp`; hosted concerns must not leak into the local stdio
package.

## Core Contracts

### Principal

- Stable internal principal ID.
- Tenant/organization ID.
- Authentication method and issuer.
- Granted scopes and entitlement version.
- Session/token identifiers stored only as hashes where feasible.

### Authorization decision

- Principal and tenant.
- Requested MCP capability/tool.
- Required scope.
- Allow/deny reason code.
- Quota/rate decision.
- Policy version and request ID.

### Internal TNL capability

- Short lifetime.
- Bound to principal, tenant, scopes, audience, and request/session context.
- Revocable or naturally expires within a bounded window.
- Never serialized into MCP content or user-visible errors.

## Workstream 1: Transport and Protocol Boundary

1. Wrap the existing Streamable HTTP server behind production ingress.
2. Enforce TLS, HTTP method/content-type rules, body limits, header limits,
   request deadlines, idle timeouts, concurrency limits, and graceful shutdown.
3. Implement MCP session lifecycle according to the current protocol version.
4. Support stateless requests where possible and bounded session state where
   required.
5. Return protocol-valid errors with request IDs and no upstream secrets.
6. Keep `/healthz`, readiness, and metrics outside the authenticated MCP route but
   free of sensitive dependency details.

## Workstream 2: OAuth/OIDC Integration

1. Select the production identity provider and document issuer/audience rules.
2. Publish the MCP protected-resource metadata required by current clients and
   point it at the external authorization server.
3. Verify the external server/client boundary supports authorization code with
   S256 PKCE, state, nonce, redirect validation, refresh rotation, and logout.
   The gateway must not host callbacks, authorization pages, or refresh tokens.
4. Support scoped client credentials or API keys only through approved external
   identity/control-plane adapters for server-to-server use.
5. Introspect access tokens and validate active state, issuer, audience, expiry,
   not-before, subject, tenant, client, and granted scopes.
6. Reject revoked, rotated, expired, or disabled access immediately within the
   documented introspection/cache bound.
7. Use a deterministic mock authorization server to prove PKCE, refresh,
   introspection, rotation, revocation, and gateway enforcement end to end.

## Workstream 3: Identity, Tenant, and Entitlement Resolution

1. Define one canonical server-side resolver from verified external identity to
   TNL user and tenant.
2. Reject ambiguous, missing, disabled, or cross-tenant mappings.
3. Load bounded entitlement and quota summaries rather than scanning unbounded
   event history on interactive requests.
4. Version policies and cache only short-lived, invalidatable decisions.
5. Represent account suspension, expired plan, exhausted quota, and missing scope
   as distinct error codes.
6. Add administrative audit trails for mapping and entitlement changes.

## Workstream 4: Capability Broker and Upstream Access

1. Exchange a verified principal decision for a short-lived internal TNL
   capability.
2. Bind capabilities to audience, tenant, principal, scopes, and expiry.
3. Prevent confused-deputy access by validating the requested tool against the
   granted scope before upstream calls.
4. Reuse the TypeScript SDK with injected per-request authorization.
5. Ensure retries respect total deadlines and never retry authentication or
   authorization failures.
6. Redact upstream authorization from errors, metrics, logs, and traces.

## Workstream 5: Quotas, Rate Limits, and Abuse Controls

1. Define per-user, per-tenant, per-client, and global limits.
2. Use atomic counters or bounded rollups with explicit reset windows.
3. Limit expensive research tools separately from simple retrieval tools.
4. Return standard retry/rate metadata without exposing other tenants.
5. Add anomaly controls for token sharing, request floods, oversized inputs, and
   repeated authorization failures.
6. Provide emergency client, principal, tenant, tool, and global disable switches.

## Workstream 6: Audit and Observability

1. Emit append-only audit events for resource access acceptance/rejection,
   revocation denial, policy decision, tool call, quota denial, and administrative
   disable actions. Correlate authorization-server login, consent, issue, refresh,
   and logout records through provider audit integration rather than duplicating
   them in the gateway.
2. Store identifiers and reason codes, not raw prompts, story bodies, credentials,
   or full tokens.
3. Add request IDs propagated through ingress, policy, MCP, SDK, and TNL upstream.
4. Measure latency, errors, quota utilization, active principals, and tool usage.
5. Define retention and deletion for logs, traces, sessions, and audit records.
6. Create operator dashboards and alerts for availability, auth failure spikes,
   upstream errors, latency, and saturation.

## Workstream 7: Deployment and Operations

1. Add production container target and environment schema.
2. Separate configuration from secrets and validate startup configuration.
3. Implement database/cache migrations with backward-compatible rollouts.
4. Add readiness that fails when critical identity/policy dependencies are
   unavailable, while health reflects process liveness only.
5. Support rolling deployment, draining, and zero-secret diagnostic bundles.
6. Document backup, restore, credential rotation, incident disable, and rollback.

## Local Development Strategy

- Install MCP and SDK from local workspaces or tarballs generated by Tool 01.
- Run the gateway against a mock IdP, mock entitlement service, and mock TNL API.
- Use locally generated TLS certificates only for test environments.
- Exercise production-like containers on loopback.
- Keep optional live TNL smoke tests bounded and runtime-secret-only.

## Security Threats to Test

- Token replay, invalid issuer/audience, expired or rotated access, and delayed
  revocation enforcement at the gateway.
- Stolen refresh token, state/nonce failure, and redirect manipulation at the
  external authorization-server/client boundary; the gateway never stores those
  values.
- Cross-tenant identity mapping and scope escalation.
- Tool-name or argument injection that bypasses policy.
- Credential leakage through exceptions, traces, sampling, or MCP structured
  content.
- Rate-limit bypass across sessions or clients.
- Denial of service through long requests, reconnect storms, and session leaks.
- Revoked user/client continuing to call cached sessions.

## Validation Matrix

| Area        | Required validation                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Protocol    | Current MCP conformance, initialize, tools/resources/prompts, errors, reconnect, shutdown                    |
| OAuth       | Resource metadata; mock-AS PKCE/state/nonce/refresh; introspection claims; rotation and revocation rejection |
| Isolation   | Cross-user, cross-tenant, cross-client, cache, and concurrency tests                                         |
| Policy      | Scope/tool matrix, entitlement versions, suspension, quota exhaustion                                        |
| Secrets     | Log/trace/error/content scans and credential rotation                                                        |
| Reliability | Load, timeout, upstream outage, IdP outage, retry storm, graceful drain                                      |
| Operations  | Health/readiness, metrics, alert, backup/restore, rollback, disable switches                                 |

## Implementation Order

1. Protocol/ingress wrapper with local anonymous test mode only.
2. Mock authorization server, protected-resource metadata, and verified principal model.
3. Tenant/entitlement policy and scope matrix.
4. Short-lived capability broker and SDK injection.
5. Quota/rate/abuse controls.
6. Audit, metrics, traces, dashboards, and alerts.
7. Deployment, migration, load, isolation, and rollback qualification.

Anonymous test mode must never be enabled in production builds or configuration.

## Acceptance Criteria

- A clean client discovers the external authorization server, completes S256 PKCE,
  refreshes its token, and calls every allowed MCP tool through the gateway.
- Missing, invalid, revoked, expired, wrong-tenant, and wrong-scope access fails
  with correct protocol errors.
- Internal TNL credentials are absent from client traffic and all evidence.
- Revocation and emergency disable take effect within the documented bound.
- Quotas are atomic and isolated across concurrent principals and tenants.
- Load and dependency-failure tests meet documented service objectives.
- Rollback preserves sessions safely or terminates them explicitly.

## Rollback

- Keep the existing local stdio and loopback HTTP package independent.
- Deploy the hosted gateway behind a feature flag and isolated hostname/path.
- Support immediate ingress disable and client revocation.
- Use backward-compatible data migrations with tested down/forward recovery.
- Never fall back from verified OAuth to a shared production API key.

## Completion Gate

Tool 02 is complete when production-equivalent local/staging tests pass, the
security and operational evidence is recorded, and Tools 05-07 can use the remote
gateway without embedding TNL credentials or duplicating policy logic.

# TNL MCP Gateway Operations

The hosted gateway is an OAuth 2.1 resource server for the read-only TNL MCP
service. TLS terminates at the production ingress. The ingress must replace, not
append, `X-Forwarded-Proto: https` and must not expose `/metrics` publicly.

## Production Configuration

Set `TNL_GATEWAY_MODE=production`. All identity and control-plane URLs must use
HTTPS. The process refuses production startup when a required value is missing.

| Variable                                  | Purpose                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| `TNL_GATEWAY_PUBLIC_URL`                  | Canonical public gateway origin                              |
| `TNL_GATEWAY_AUTHORIZATION_SERVERS`       | Comma-separated OAuth issuer URLs                            |
| `TNL_GATEWAY_ISSUER`                      | Exact accepted introspection issuer                          |
| `TNL_GATEWAY_AUDIENCE`                    | Exact MCP resource audience; defaults to public `/mcp` URL   |
| `TNL_GATEWAY_INTROSPECTION_URL`           | RFC 7662 token introspection endpoint                        |
| `TNL_GATEWAY_INTROSPECTION_CLIENT_ID`     | Confidential introspection client ID                         |
| `TNL_GATEWAY_INTROSPECTION_CLIENT_SECRET` | Confidential introspection secret                            |
| `TNL_GATEWAY_ACCESS_URL`                  | Identity-to-tenant and entitlement resolver                  |
| `TNL_GATEWAY_CAPABILITY_URL`              | Short-lived, audience-bound TNL capability broker            |
| `TNL_GATEWAY_QUOTA_URL`                   | Atomic distributed quota decision endpoint                   |
| `TNL_GATEWAY_DISABLE_URL`                 | Emergency global, tenant, client, principal, and tool switch |
| `TNL_GATEWAY_AUDIT_URL`                   | Append-only audit event collector                            |
| `TNL_GATEWAY_IDP_HEALTH_URL`              | Unauthenticated identity-provider readiness probe            |
| `TNL_GATEWAY_CONTROL_HEALTH_URL`          | Authenticated control-plane readiness probe                  |
| `TNL_GATEWAY_SERVICE_TOKEN`               | Workload token used only with control-plane services         |
| `TNL_GATEWAY_ALLOWED_ORIGINS`             | Exact browser origins, comma separated                       |
| `TNL_GATEWAY_RESEARCH_URL`                | Optional internal Tool 05 research-service HTTPS origin      |
| `TNL_GATEWAY_RESEARCH_SERVICE_TOKEN`      | Dedicated internal research-service workload token           |
| `TNL_GATEWAY_RESEARCH_TIMEOUT_MS`         | Research request timeout; defaults to 45000                  |

Supply secrets through the deployment secret manager. Do not put them in image
layers, Compose files, command arguments, diagnostic bundles, or source control.
External OAuth tokens are introspected and discarded per request. They are never
sent to the TNL API. The capability broker must issue a different, short-lived
TNL token bound to tenant, principal, requested tools, audience, and expiry.

When `TNL_GATEWAY_RESEARCH_URL` is configured, the gateway exposes all six Tool
05 workflows to principals with `tnl:research`. The research service must
authenticate `TNL_GATEWAY_RESEARCH_SERVICE_TOKEN` before trusting the forwarded
`X-TNL-Tenant-Id` and `X-TNL-User-Id` identity. Keep the service on private HTTPS
networking and reject those headers from every other caller. If the integration
is absent or unhealthy, the gateway does not advertise the six runner-backed
tools and readiness fails for an unhealthy configured runner.

## Identity Contract

The introspection result must be active and contain exact `iss`, expected `aud`,
`sub`, `client_id`, and a future `exp`. Optional `nbf` must not be in the future.
The access resolver maps `(issuer, subject)` to exactly one principal and tenant.
If the token contains `tenant_id` or `organization`, it must equal the mapped
tenant. Missing, ambiguous, disabled, or cross-tenant mappings fail closed.

Clients discover authorization servers through
`/.well-known/oauth-protected-resource` or
`/.well-known/oauth-protected-resource/mcp`. The authorization server owns the
authorization-code with S256 PKCE, state/nonce, exact redirect registration,
consent, refresh rotation, client credentials, logout, and revocation flows. The
gateway is the resource server and validates every request; it does not handle or
store browser authorization codes or refresh tokens.

## Health And Objectives

- `/healthz` is process liveness and returns no dependency detail.
- `/readyz` checks configured adapter health contracts and removes an unhealthy
  instance from service.
- `/metrics` contains bounded outcome, reason, and tool labels only.
- Target availability: 99.9% monthly; p95 gateway overhead below 150 ms excluding
  TNL research time; zero accepted wrong-audience or cross-tenant requests.
- Alert on readiness failure, authentication denial spikes, dependency failures,
  quota saturation, concurrency rejection, p95 latency, and capability errors.

Audit records contain request ID, hashed principal/tenant/client identifiers,
tool, policy version, outcome, reason, and duration. They must not contain tokens,
keys, prompts, story bodies, tool arguments, upstream responses, or IP addresses.
Retain security audit records for 90 days unless the production privacy policy
requires a shorter period; retain operational metrics for 30 days.

## Deployment And Rollback

1. Build `Dockerfile.gateway`, scan the image, and pin the resulting digest.
2. Apply configuration without secrets, then inject secrets from the production
   secret manager using workload identity where available.
3. Deploy one canary replica behind an isolated hostname or disabled route.
4. Verify protected-resource metadata, invalid-token rejection, readiness,
   metrics scrape, capability exchange, and a bounded read-only MCP tool call.
5. Increase traffic gradually while watching auth denials, upstream errors, and
   p95 latency. Keep the existing local MCP endpoint independent.
6. Roll back by disabling gateway ingress, revoking the gateway service client,
   and restoring the previous image digest. Never fall back to a shared client
   API key or bypass OAuth.

The gateway has no local database and therefore no schema migration or backup.
The identity, quota, disable, audit, and capability services own their durable
data, backward-compatible migrations, backups, restore tests, and retention.

## Incident Controls

1. Activate the global disable switch for suspected credential or isolation
   incidents. Use narrower tenant, principal, client, or tool switches when safe.
2. Revoke the affected OAuth client/session and capability-broker credentials.
3. Rotate `TNL_GATEWAY_SERVICE_TOKEN`, introspection credentials, and capability
   broker credentials independently. Restart replicas to discard old values.
4. Export only request IDs, reason codes, hashed identifiers, timings, version,
   and health states. Do not collect environment dumps or request bodies.
5. Re-enable through a canary after negative auth, cross-tenant, quota, and secret
   scans pass.

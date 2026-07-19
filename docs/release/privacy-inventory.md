# Privacy Inventory

TNL Intelligence tools are read-only intelligence and research surfaces. They do
not place trades, connect brokerage accounts, or require physical-location data.

| Tool surface          | Processes                                                                   | Persists                                                                           | Transmits                                           | Deletion/revocation                                                     |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| SDK, CLI, daemon      | API key, query/filter, public intelligence response                         | CLI daemon stores revision-aware local events and cursors with private permissions | TNL API or configured gateway                       | Remove local state; revoke or rotate key                                |
| Hosted gateway        | External subject, tenant, scopes, quota, request ID                         | Bounded audit/usage records without raw credentials                                | TNL API and authorized research service             | Revoke grant/key; retention worker removes expired audit data           |
| Developer onboarding  | Developer-key verifier, quota counter                                       | One-way scrypt verifier and deletion-resistant issuance counter                    | Bounded sample API                                  | Revoke key; delete developer profile subject to abuse counter retention |
| Webhooks              | Subscription filters, encrypted destination secret, signed event metadata   | Encrypted subscription, outbox, bounded delivery history and dead letters          | Subscriber HTTPS endpoint                           | Disable/delete subscription; expire history; rotate signing key         |
| Research and MCP App  | Prompt, tenant/user IDs, evidence, claims, citations, budgets               | Saved results only when explicitly requested; bounded task/audit metadata          | TNL, enabled Docdex/Codali, and opt-in web provider | Delete saved result; revoke grant; disable provider                     |
| AI adapters           | Host configuration and OAuth/API authorization reference                    | Host-controlled configuration; bundles contain no credential                       | Configured local or remote MCP server               | Logout, delete host configuration, uninstall archive                    |
| Automation connectors | Connection reference, action inputs, event payload                          | Host-controlled connection and dedupe state                                        | TNL gateway/webhook service and selected workflow   | Delete connection, unsubscribe trigger, revoke key                      |
| Quant toolkit         | Public intelligence revisions, timestamps, mappings, user-supplied outcomes | Local immutable revisions, snapshots, manifests, optional Parquet/DuckDB           | None unless the user syncs from TNL                 | Purge local dataset or selected revision set                            |

## Controls

- Credentials are accepted only through environment variables, authorization
  headers, encrypted service storage, or host secret fields. They are redacted
  from errors, logs, screenshots, evidence, archives, and diagnostics.
- Tenant and actor identifiers participate in authorization and cache keys.
  Shared fixture/evaluation artifacts contain synthetic identifiers only.
- Workspace context, saved research, web retrieval, and optional diagnostics are
  opt-in. Deterministic local fixtures are the default qualification path.
- Automated output identifies **TNL Bot**, preserves source citations and `asOf`,
  and discloses incomplete or unavailable evidence.
- Public release evidence excludes production responses, raw prompts, personal
  data, private tenant data, credentials, and restricted source bodies.
- Telemetry is operational and bounded: request ID, component/version, outcome,
  duration, quota/rate-limit class, and redacted error code. Content and secrets
  are not approved telemetry fields.

## External Processors

TNL, the configured identity provider, Docdex, Codali/mswarm, optional web
research, and automation hosts process only the data required for the enabled
workflow. Live processor configuration, regional terms, and owner acceptance are
deployment and business approval gates, not implied by local qualification.

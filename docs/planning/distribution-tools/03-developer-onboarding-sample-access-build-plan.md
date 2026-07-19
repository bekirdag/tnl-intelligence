# Tool 03: Developer Onboarding and Sample Access Build Plan

Date: 2026-07-19
Status: Repository implementation complete; public hosted deployment remains an owner gate
Progress: [Developer Onboarding and Sample Access Build Progress](03-developer-onboarding-sample-access-build-progress.md)
Parent: [TNL Distribution Tools High-Level Build Plan](../tnl-distribution-tools-build-plan.md)
Depends on: [Tool 01 Local Integration Harness](01-local-integration-harness-build-plan.md)
Integrates with: [Tool 02 Remote MCP Gateway](02-remote-mcp-gateway-build-plan.md)

## Objective

Build a self-service developer experience that lets a new user understand the
TNL contract, evaluate representative intelligence, create bounded credentials,
and reach a first successful API or MCP result without manual maintainer help or
public npm/PyPI availability.

## Required Outcomes

1. Secure developer-key lifecycle with scopes, quotas, usage, and revocation.
2. Bounded sample tier and a no-key static demo dataset.
3. Canonical hosted OpenAPI contract and interactive explorer.
4. Generated quick starts for `curl`, TypeScript, Python, CLI, and MCP.
5. Postman collection and safe environment generated from the same contract.
6. First-success and error telemetry without collecting credentials or private
   query/story content.

## Scope

### Included

- Developer portal/account surfaces for keys, scopes, usage, and limits.
- Sample-tier policy and static demonstration dataset.
- Documentation site, API explorer, OpenAPI hosting, examples, and Postman assets.
- Local unpublished-package instructions and artifact-based examples.
- Onboarding tests, accessibility, support, and credential recovery guidance.

### Excluded

- Package or marketplace publication.
- Production billing implementation beyond entitlement hooks.
- Social login/provider selection owned by the main TNL identity system.
- Full research application UI, webhooks, or third-party connectors.

## User Journeys

1. **No-account evaluation:** inspect the schema and run static sample queries.
2. **Developer evaluation:** create a bounded key and call a live read-only API.
3. **Local SDK evaluation:** install a provided local tarball/wheel and run a
   quick start against mock/sample/live endpoints.
4. **MCP evaluation:** configure a local MCP server or hosted gateway and invoke a
   cited retrieval workflow.
5. **Operations:** view usage, rotate/revoke a key, understand quota errors, and
   remove the developer account.

## Architecture

```text
Developer portal
  |-- identity/session from TNL
  |-- key service -> hashed credentials + scope/quota metadata
  |-- usage service -> bounded rollups
  |-- docs/explorer -> canonical OpenAPI
  |-- sample API -> static licensed fixtures
  |-- quick-start generator -> curl/TS/Python/CLI/MCP/Postman
```

The portal never receives recoverable stored API keys after initial creation.
Usage pages read bounded aggregates rather than raw request logs.

## Workstream 1: Developer Credential Service

1. Define key format with a non-secret prefix for identification and a high-
   entropy secret shown only once.
2. Store only a strong verifier/hash plus owner, tenant, scopes, status, created,
   expiry, last-used summary, and rotation lineage.
3. Limit key count, scope combinations, expiry, and creation rate by entitlement.
4. Add create, list metadata, rotate, revoke, and delete operations.
5. Require recent authentication or step-up controls for destructive credential
   actions.
6. Propagate revocation promptly to API and remote MCP policy caches.
7. Audit lifecycle events without recording the secret.

## Workstream 2: Sample Tier and No-Key Dataset

1. Define a bounded evaluation entitlement: allowed endpoints/tools, daily quota,
   concurrency, response limits, and retention.
2. Separate sample-tier behavior from paid/member entitlements through policy,
   not client-side conditions.
3. Build a small, licensed, non-sensitive static dataset with stories, revisions,
   entities, assets, impact paths, sources, and empty/error examples.
4. Version the sample dataset and response schema.
5. Expose a clearly labeled no-key demo endpoint or local fixture service that
   cannot query production member data.
6. Add abuse controls and cacheable responses for the static lane.

## Workstream 3: Canonical OpenAPI and Explorer

1. Select one canonical generated OpenAPI artifact and public stable URL.
2. Validate it in CI against the vendored snapshot and implementation routes.
3. Add operation descriptions, auth, scopes, pagination, rate headers, timestamps,
   revisions, errors, attribution, and examples.
4. Host an interactive explorer that never persists user keys and defaults to the
   sample endpoint.
5. Allow live-key use only through local/session memory with visible clearing.
6. Add accessibility, keyboard, mobile, and copy/paste tests.

## Workstream 4: Quick Starts and Local Artifact Flows

1. Generate examples from the canonical contract where practical.
2. Provide `curl` first-success, pagination, error, and revision examples.
3. Provide TypeScript examples using a workspace or local tarball install.
4. Provide Python examples using editable install or local wheel.
5. Provide CLI and MCP examples using locally packed binaries/configuration.
6. Show expected output shape and source/citation fields without using unstable
   live story text in assertions.
7. Test every quick start in Tool 01 clean consumers.

## Workstream 5: Postman Assets

1. Generate the collection from canonical OpenAPI.
2. Add folders, descriptions, auth helper, pagination examples, and tests.
3. Create a public-safe environment with empty `TNL_API_KEY` and sample base URL.
4. Add sample responses with licensed/static data only.
5. Run collection tests locally against sample and mock servers.
6. Detect drift between Postman requests and OpenAPI in CI.

## Workstream 6: Usage, Limits, and Support UX

1. Show current plan/tier, scopes, request quota, reset window, and recent bounded
   usage aggregates.
2. Explain 401, 403, 429, timeout, empty-result, and revision semantics with a
   concrete next action.
3. Link status, changelog, support, privacy, terms, acceptable use, retention,
   account deletion, and source attribution.
4. Add onboarding checkpoints: viewed key, first API success, first MCP success,
   and first local SDK success.
5. Store only event categories and timestamps needed for funnel analysis; do not
   store keys, raw prompts, or story bodies.

## Workstream 7: Documentation Information Architecture

- Start: API, MCP, CLI, TypeScript, Python, Postman, sample data.
- Concepts: stories, sources, revisions, entities, assets, impact paths, time.
- Guides: cited agent, monitoring, weekly brief, event study, connector preview.
- Reference: OpenAPI, MCP tools/resources/prompts, errors, quotas, changelog.
- Operations: key management, status, security, support, deletion, deprecations.

Every page must use canonical terminology and link to a runnable local/sample
path.

## Local Development Strategy

- Run the portal and docs against mock identity, mock key service, and sample API.
- Install JS/Python examples from Tool 01 local artifacts.
- Keep live credentials runtime-only and optional.
- Run Postman/Newman-compatible tests locally without a public workspace.
- Serve the OpenAPI explorer on loopback during development.

## Security and Privacy Requirements

- API key secret is shown once and never retrievable.
- Key input fields disable telemetry, analytics capture, and accidental URL/query
  placement.
- Explorer and Postman examples contain placeholders only.
- Sample data has documented provenance and redistribution rights.
- Account deletion revokes keys and schedules retained metadata deletion.
- Usage rollups are tenant-scoped, bounded, and free of content payloads.

## Validation Matrix

| Area          | Required validation                                                          |
| ------------- | ---------------------------------------------------------------------------- |
| Key lifecycle | Create, one-time display, authenticate, rotate, revoke, expiry, limit, audit |
| Isolation     | Cross-user/tenant key access and usage-rollup tests                          |
| Sample tier   | Policy limits, static-only data, abuse controls, schema compatibility        |
| OpenAPI       | Schema lint, route drift, examples, auth/scopes, breaking-change checks      |
| Explorer      | No persistence, sample default, key clear, accessibility, error guidance     |
| Quick starts  | Exact commands in clean tarball/wheel consumers                              |
| Postman       | Generated drift check, placeholder secrets, collection tests                 |
| Telemetry     | First-success metrics with no key, prompt, or story-content capture          |

## Implementation Order

1. Key and sample-tier domain contracts.
2. Static dataset and mock/sample service.
3. Credential service and portal key lifecycle.
4. Canonical OpenAPI hosting and explorer.
5. Generated quick starts and local artifact validation.
6. Postman generation/tests.
7. Usage/support UX, accessibility, security, and end-to-end onboarding tests.

## Acceptance Criteria

- A new test user creates, uses, rotates, and revokes a bounded key without
  maintainer intervention.
- A no-account user can inspect realistic static responses safely.
- Every quick start succeeds from a clean local consumer without npm/PyPI.
- OpenAPI, explorer, Postman, and package types agree on the tested contract.
- No real key appears in client storage, URLs, logs, analytics, examples, or
  generated assets.
- Usage and quota displays remain correct under concurrent requests and resets.
- Account deletion and credential revocation complete within documented bounds.

## Rollback

- Feature-flag live key creation separately from static sample/docs.
- Retain read-only docs and sample access if the credential service is disabled.
- Version OpenAPI and sample datasets so a breaking contract can be reverted.
- Revoke newly issued evaluation keys in bulk if policy or leakage defects occur.
- Never fall back to a shared key in the browser.

## Completion Gate

Tool 03 is complete when all onboarding journeys pass locally/staging, examples
install only local artifacts, security evidence is recorded, and Tools 05-10 can
link to a stable authentication, sample, documentation, and contract experience.

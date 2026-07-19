# TNL Intelligence Automation Connectors Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; external platform registration and publication remain owner gates
- **Progress:** [`08-automation-connectors-build-progress.md`](08-automation-connectors-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 01 local integration harness, Tool 03 developer onboarding, Tool 04 webhook delivery
- **Unblocks:** Workflow automation distribution and cross-tool qualification

## Objective

Build a shared automation connector core and native integrations for n8n, Pipedream, and Zapier. The connectors must make TNL intelligence easy to trigger on, search, retrieve, and enrich while preserving consistent schemas, authentication, attribution, rate-limit behavior, and local testability.

## Required Outcomes

1. A host-neutral connector core containing normalized inputs, outputs, pagination, errors, and webhook verification.
2. Actions and triggers with parity across n8n, Pipedream, and Zapier where each platform supports them.
3. Durable instant triggers backed by Tool 04 signed webhooks.
4. Polling fallbacks only where required, with cursor and deduplication guarantees.
5. Fixture-based local test harnesses using packed npm artifacts.
6. Platform-specific packages that follow current official contribution and dependency rules.
7. Security, privacy, support, and marketplace evidence without performing publication.

## Scope

### Included

- Shared client/connector adapters around the existing TypeScript SDK and webhook verifier.
- Search, get, recent/change, entity/asset exposure, and research actions.
- New/updated intelligence and weekly-edition triggers.
- OAuth/API-key connection profiles supported by each platform.
- Dynamic fields/options where they materially improve usability.
- Pagination, retries, rate-limit guidance, and idempotency.
- Local connector runners and deterministic fixtures.
- Platform validation, documentation, icons, and test workflows.

### Excluded

- Publishing packages or submitting marketplace listings.
- User account creation for automation platforms.
- A connector-specific copy of TNL API or research orchestration.
- Trade execution, broker credentials, or autonomous investment actions.
- Social-account publishing actions in the first release.

## Connector Principles

- Normalize behavior in shared code but respect each platform's native UX.
- Return stable IDs and machine-readable timestamps, not presentation-only prose.
- Use instant signed webhooks when available; do not poll needlessly.
- Make pagination and deduplication explicit.
- Keep credentials in platform-managed stores.
- Attribute automated research to TNL Bot and preserve source/citation fields.
- Avoid hidden network calls during configuration or field rendering.

## Architecture

```text
TNL SDK + webhook verifier + research contracts
                       |
             connector-core package
              /          |          \
           n8n       Pipedream      Zapier
            |             |            |
      actions/triggers actions/triggers actions/triggers
```

The core maps platform-neutral operations to the TNL API, MCP/research endpoint where approved, and Tool 04 event envelope. Platform packages translate native inputs and outputs without changing semantics.

## Shared Connector Core

### Responsibilities

- Connection validation without returning credential values.
- Operation input normalization and schema validation.
- TNL API calls through the existing SDK.
- Pagination cursor handling.
- Retry classification and `Retry-After` normalization.
- Webhook signature verification and event parsing.
- Trigger filter serialization.
- Stable output normalization.
- Privacy-safe error translation.
- Fixture clients and request recording for platform tests.

### Exclusions

- Platform UI components.
- Platform SDK/runtime imports.
- Persistent credential storage.
- Platform-specific logging or retry APIs.

## Common Authentication Profiles

### API Key

- Intended for local development and platforms whose OAuth support cannot satisfy the gateway flow.
- Stored only in the platform's credential system.
- Validated through a safe identity/capability request.
- Never returned in errors, logs, dynamic fields, or action output.

### OAuth

- Preferred for hosted multi-user connectors when the platform supports the Tool 02 authorization flow.
- Uses least-privilege scopes and refresh-token rotation.
- Handles revocation, reauthorization, and tenant/account switching.
- Does not share one user's credential across workspace members unless platform semantics explicitly require and disclose it.

## Common Action Catalog

### 1. Search Intelligence

- Inputs: query, time window, categories, geographies, entities, assets, impact/confidence threshold, page size/cursor.
- Output: stable item array, next cursor, `asOf`, and normalized metadata.

### 2. Get Intelligence Item

- Input: stable TNL ID or canonical URL.
- Output: structured story/intelligence record, revision, citations, related entities, and canonical link.

### 3. List Recent Changes

- Inputs: since timestamp/cursor and optional filters.
- Output: published, updated, and retracted items with revision state.

### 4. Get Entity or Asset Exposure

- Inputs: entity/asset, event or time range, depth.
- Output: structured relationships, impact paths, confidence, horizons, and evidence links.

### 5. Run Research Skill

- Inputs: approved Tool 05 skill, question/IDs, time range, depth.
- Output: task/result ID and, when completed synchronously, answer, claims, evidence, citations, `asOf`, and completion state.
- Long-running hosts use an asynchronous pattern when synchronous duration limits would be exceeded.

### 6. Get Research Result

- Input: stable research result ID returned by a research run.
- Output: the tenant-scoped result with answer, claims, evidence, citations,
  `asOf`, and completion state; missing or inaccessible IDs return a normalized
  not-found error.

### 7. Get Weekly Edition

- Inputs: week/date and optional filters.
- Output: ranked developments and structured edition metadata.

## Common Trigger Catalog

### Instant Triggers

- New intelligence published.
- Intelligence materially updated.
- Intelligence retracted.
- Impact classification changed.
- Weekly consequential edition published.

### Trigger Filters

- Category and geography.
- Entity and asset.
- Impact and confidence threshold.
- Language and event type.

### Trigger Guarantees

- Stable event and resource IDs.
- At-least-once delivery with documented deduplication key.
- Signed payload verification before acknowledging the event.
- Platform-specific subscription cleanup on workflow disable/delete.
- Replay-safe behavior where the platform supports dedupe storage.

## Polling Fallback

Use only for a platform or environment that cannot accept Tool 04 webhooks:

- Persist an opaque cursor rather than infer order from local clock time.
- Include overlap to tolerate clock and indexing delay, then deduplicate by event ID.
- Bound lookback and page count.
- Preserve retractions and updates, not only newly created items.
- Emit no events on the first activation unless the user chooses a backfill window.
- Test restart, cursor loss, duplicate pages, late arrival, and API throttling.

## n8n Integration Workstream

### Package

- Use the current n8n community-node package conventions verified from official docs.
- Keep production dependencies within the platform's allowed policy; prefer the shared core only when packaging rules permit it.
- Include credential types, action nodes, trigger nodes, icons, descriptions, and examples.
- Support declarative operations where appropriate and programmatic nodes where webhook lifecycle or research polling requires it.

### Required Nodes

- TNL Intelligence action node with all seven common operations.
- TNL Trigger node for signed instant events.
- Research-result retrieval for long tasks.

### n8n Tests

- Lint/package validation required by the current n8n toolchain.
- Credential test and redaction.
- Node execution with fixture-backed HTTP.
- Webhook create/check/delete lifecycle.
- Workflow activation/deactivation and duplicate event handling.
- Clean installation from a local package tarball.

## Pipedream Integration Workstream

### Package

- Follow the current Pipedream component repository conventions.
- Implement a TNL app/auth definition, actions, and sources/triggers.
- Keep component properties and emitted event metadata stable and concise.
- Use platform checkpoint/deduplication facilities where available.

### Required Components

- All seven common actions, including recent changes and separate research
  run/result retrieval.
- New/updated intelligence source using Tool 04 webhooks when supported.
- Weekly edition source.

### Pipedream Tests

- Component schema and lint validation.
- Auth checks without credential output.
- Deploy-hook lifecycle against a local/staging webhook endpoint.
- Emitted event IDs, summaries, and dedupe behavior.
- Long-running research timeout and polling continuation.

## Zapier Integration Workstream

### Package

- Use the current Zapier Platform CLI/runtime conventions.
- Provide authentication, searches, creates/actions, and REST Hook triggers.
- Model dynamic dropdowns only for bounded stable options; use inputs for open-ended entities and categories.
- Define sample data that matches real output schemas and contains no private content.

### Required Operations

- All seven common operations across creates/searches as the host requires.
- New or updated intelligence REST Hook trigger.
- Weekly edition trigger.

### Zapier Tests

- Authentication success/failure and refresh if OAuth is used.
- Operation input/output schemas and sample data.
- REST Hook subscribe/unsubscribe/perform lifecycle.
- Hydration only if necessary and within current platform guidance.
- Rate-limit error mapping and user-facing retry guidance.
- Local CLI validation without publishing.

## Platform Parity Contract

Maintain a table generated from shared operation metadata:

| Capability      | Core     | n8n      | Pipedream | Zapier   | Notes                             |
| --------------- | -------- | -------- | --------- | -------- | --------------------------------- |
| Search          | Required | Required | Required  | Required | Same filters and cursor semantics |
| Get item        | Required | Required | Required  | Required | Stable ID or canonical URL        |
| Exposure        | Required | Required | Required  | Required | Structured impact paths           |
| Run research    | Required | Required | Required  | Required | Async fallback where needed       |
| Get result      | Required | Required | Required  | Required | Tenant-scoped stable result ID    |
| Webhook trigger | Required | Required | Required  | Required | Tool 04 signatures                |
| Weekly edition  | Required | Required | Required  | Required | Action and/or trigger             |

Any intentional platform difference must have a documented platform constraint and test.

## Output Contract

- Preserve TNL stable IDs, canonical URLs, revisions, and timestamps.
- Use ISO 8601 UTC timestamps plus separate event/publication/retrieval fields.
- Return arrays and objects, not JSON encoded inside strings.
- Preserve citation and evidence URLs where the operation provides them.
- Include `asOf` and completion state for research outputs.
- Keep large bodies optional and opt-in to avoid workflow payload limits.
- Provide a predictable raw-output escape hatch only where the platform convention supports it.

## Rate Limits and Reliability

- Respect TNL server rate-limit headers and bounded `Retry-After`.
- Let platform-native retry facilities handle retryable operations where safe.
- Never automatically retry a request whose idempotency is unknown.
- Add idempotency keys to asynchronous research creation when supported.
- Bound page size, pages per execution, webhook replay range, and research wait time.
- Return normalized error codes for auth, entitlement, validation, not found, rate limit, upstream unavailable, and internal failure.

## Security and Privacy

- Store secrets only in platform credential facilities.
- Verify webhook signatures from the raw body before parsing.
- Reject stale and duplicate webhook deliveries according to Tool 04 guidance.
- Do not log story bodies, research prompts, credentials, or source excerpts by default.
- Prevent server-side request parameters from accepting arbitrary URLs unless explicitly required and validated.
- Test tenant isolation in connection validation, action lookup, and webhook subscription ownership.
- Include privacy, deletion, support, and security-contact links in marketplace metadata.

## Local Development Strategy

1. Pack the SDK, webhook helper, and connector core into local tarballs.
2. Install tarballs into each connector package without workspace linking.
3. Start the Tool 01 mock API/MCP and Tool 04 local webhook dispatcher.
4. Run platform-specific local CLIs/runners against deterministic fixtures.
5. Capture outbound requests and compare them with shared golden contracts.
6. Use opt-in staging only for hosted callback validation that cannot run locally.
7. Do not publish packages during implementation or qualification.

## Test Strategy

### Core Tests

- Input normalization and validation.
- Pagination and cursor passthrough.
- Retry/error mapping.
- Webhook verification and filtering.
- Output schema and redaction.

### Parity Tests

- Run the same fixture scenario through each platform adapter.
- Compare stable IDs, timestamps, filters, paging, citations, and error class.
- Verify intentional host-specific presentation differences do not change semantics.

### Lifecycle Tests

- Create connection, validate, run action, activate trigger, receive event, deactivate, revoke connection.
- Upgrade connector package without duplicating webhook subscriptions.
- Delete workflow and confirm remote subscription cleanup.
- Recover from temporary API and webhook failures.

### Marketplace-Readiness Tests

- Manifest/schema validation against current official tooling.
- Icon, description, category, support, privacy, and example completeness.
- No secrets or private fixture data in package archives.
- Install/package size and dependency policy compliance.
- Reviewer workflow evidence from stable fixtures.

## Implementation Order

1. Verify current n8n, Pipedream, and Zapier official connector requirements.
2. Freeze common operation, trigger, authentication, output, and error contracts.
3. Implement the host-neutral connector core and fixtures.
4. Deliver n8n actions and trigger as the first vertical slice.
5. Add parity tests and harden the webhook lifecycle.
6. Implement Pipedream actions and sources from the same contracts.
7. Implement Zapier actions/searches and REST Hook triggers.
8. Add research async behavior and weekly-edition workflows.
9. Run credential, tenant, rate-limit, replay, and cleanup tests.
10. Generate marketplace metadata and reviewer evidence.
11. Freeze local package candidates for Tool 10 without publishing.

## Validation Commands

The exact platform commands will follow their current toolchains; the repository must expose an aggregate interface equivalent to:

```bash
pnpm build
pnpm test
pnpm test:connectors:core
pnpm test:connector:n8n
pnpm test:connector:pipedream
pnpm test:connector:zapier
pnpm test:connectors:parity
pnpm connectors:pack:local
```

## Acceptance Criteria

- Shared actions and triggers have equivalent semantics across all three platforms or a documented, tested constraint.
- Signed instant triggers complete subscription create, deliver, verify, deduplicate, disable, and delete lifecycles.
- Polling fallback preserves updates/retractions and does not duplicate events across restarts.
- Credentials and tenant data remain isolated and redacted.
- Research operations preserve evidence, citations, `asOf`, TNL Bot identity, and completion state.
- Each connector installs and runs from local tarballs with deterministic fixtures.
- Current official platform validators and packaging policies pass.
- Marketplace artifacts are review-ready, but no external package or listing is published.

## Rollback

- Disable new webhook subscriptions per connector without disabling existing API clients.
- Revert a platform package independently while keeping shared contracts backward compatible.
- Fall back from instant trigger to documented polling only when security and deduplication tests pass.
- Revoke a compromised OAuth client or API credential through the platform connection.
- Retain the prior connector version and migration notes for active workflows.

## Completion Gate

This tool is complete only when the shared core, n8n, Pipedream, and Zapier integrations, webhook lifecycles, parity tests, credential protections, local package qualification, and review artifacts pass the release criteria without external publication.

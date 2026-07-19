# TNL Intelligence AI Client Adapters Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; external owner validation deferred
- **Progress:** [`07-ai-client-adapters-build-progress.md`](07-ai-client-adapters-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 02 remote MCP gateway, Tool 05 research skills and app, Tool 06 MCP installation artifacts
- **Unblocks:** Broad editor/AI-client distribution and final release qualification

## Objective

Build thin, maintainable integrations for Cursor and OpenAI client surfaces that expose the same TNL Intelligence MCP and research contracts. The adapters must improve discovery and workflow fit without duplicating retrieval, orchestration, authorization, or business logic inside vendor-specific bundles.

## Required Outcomes

1. A shared adapter core for prompts, capability checks, error mapping, citations, and user-facing metadata.
2. A Cursor plugin/integration package that installs local or remote TNL MCP configuration and focused research commands.
3. An OpenAI-compatible app/plugin package backed by the hosted MCP gateway and research app.
4. Vendor manifests generated or validated from canonical metadata where practical.
5. Clean-profile installation, authentication, positive, negative, and uninstall tests.
6. Review-ready privacy, safety, support, and demo artifacts.
7. Local qualification without marketplace submission or published package dependencies.

## Scope

### Included

- Shared adapter contracts and presentation helpers.
- Cursor rules/commands/skills or plugin surfaces supported by the current platform.
- OpenAI app/plugin metadata and MCP-backed tools supported by the current platform.
- Local stdio and remote OAuth connection modes where the host allows them.
- Research UI resource reuse from Tool 05.
- Capability negotiation and graceful degradation.
- Installation, verification, upgrade, removal, and review evidence.

### Excluded

- Reimplementing TNL API or Codali orchestration in a plugin.
- Host-specific copies of research prompts that can drift independently.
- Automatic trades or personalized financial recommendations.
- Marketplace account creation, submission, or reviewer communication.
- Unsupported private APIs or undocumented configuration formats.

## Adapter Principles

- Keep vendor code thin; shared behavior belongs in typed packages or hosted services.
- Verify current official platform schemas during implementation because client requirements change.
- Advertise only capabilities proven by runtime introspection.
- Prefer host-managed OAuth for remote access and environment/secret inputs for local access.
- Never expose private chain-of-thought; provide concise tool, evidence, and citation provenance.
- Treat external content as untrusted and enforce Tool 05 research policies server-side.
- Provide useful text/JSON when a host cannot render the rich research interface.

## Architecture

```text
Cursor integration          OpenAI integration
        \                      /
         shared adapter contracts
                    |
       local MCP or remote MCP gateway
                    |
          research skills and TNL API
                    |
       structured result + optional UI
```

Neither integration calls TNL data services directly from browser/plugin code when the MCP boundary already provides the capability.

## Shared Adapter Core

Create a package that contains:

- Stable command/skill identifiers and display metadata.
- Research task builders for the supported Tool 05 skill catalog.
- Capability negotiation and minimum-version checks.
- Normalized error classes and recovery guidance.
- Citation and TNL resource link rendering.
- Result-to-Markdown fallback rendering.
- Host-neutral telemetry events with privacy-safe fields.
- Fixtures for authenticated, unauthorized, partial, stale, rate-limited, and failed runs.

Do not include host SDK dependencies in the shared core. Define small ports that host packages implement.

## Common User Workflows

1. Ask what changed over a specified time window.
2. Validate a selected claim or TNL story.
3. Compare sources covering the same development.
4. Map an event to entities, sectors, assets, and time horizons.
5. Generate a cited weekly consequential-developments brief.
6. Open the rich evidence/timeline view when supported.
7. Export structured JSON or cited Markdown for downstream work.

Every workflow must require an explicit time range or resolve one visibly, show `asOf`, and preserve automated TNL Bot attribution.

## Cursor Integration Workstream

### Package Layout

```text
integrations/cursor/
  manifest/
  commands/
  skills/
  rules/
  generated/
  tests/
  README.md
```

Adjust the exact layout to the current Cursor plugin schema after official-document validation.

### Capabilities

- Install or reference the generated MCP configuration from Tool 06.
- Provide focused commands for the shared research workflows.
- Offer repository-aware prompts only when the user explicitly includes workspace context.
- Render cited Markdown in chat and open the Tool 05 research UI through supported resource links.
- Surface authentication, quota, gateway, and stale-result failures with direct recovery steps.
- Keep rules concise and scoped so they do not override unrelated project behavior.

### Local and Remote Modes

- **Local mode:** run the packed MCP server from a Tool 06 artifact using a user-provided API key.
- **Remote mode:** connect to the hosted MCP gateway using host-supported OAuth.
- Detect conflicting configurations and ask the user to choose one active profile.
- Never migrate or delete credentials automatically when switching modes.

### Cursor Validation

- Install into a clean user profile and a clean sample project.
- Verify command discovery and MCP capability negotiation.
- Execute each workflow against deterministic fixtures.
- Test absent credentials, expired credentials, unsupported server version, rate limit, and network failure.
- Confirm unrelated editor projects do not inherit project-scoped rules.
- Upgrade and uninstall without leaving active server processes or secret files.

## OpenAI Integration Workstream

### Supported Surface Discovery

At implementation time, verify current official OpenAI documentation for:

- App/plugin manifest schema and distribution requirements.
- Remote MCP transport and OAuth requirements.
- Tool annotations, content types, and UI resource behavior.
- Domain verification, privacy, support, and review requirements.
- Test-account and reviewer-instruction rules.

Record the verified documentation URLs and access date in the release evidence. Do not encode unverified marketplace assumptions in source.

### Capabilities

- Connect only through the remote MCP gateway from Tool 02 unless the current host explicitly supports local MCP.
- Expose the typed Tool 05 research actions with accurate read-only annotations.
- Return concise answer text, structured claims/evidence, citations, and an optional research UI resource.
- Use OAuth scopes no broader than the requested TNL capabilities.
- Provide deterministic demo/test data when reviewer credentials should not access live private data.
- Surface retention, external-data access, automated authorship, and financial-research limitations.

### OpenAI Validation

- Validate manifests and resources against current official schemas.
- Complete OAuth authorization, refresh, revocation, and cross-account isolation tests.
- Test every advertised action with normal and minimum entitlements.
- Exercise explicit positive and negative prompt sets, including unrelated requests and disallowed trading-advice requests.
- Verify citations and external links open the correct TNL or evidence resources.
- Confirm UI resources degrade to accessible structured text when unavailable.
- Prepare reviewer instructions that use stable fixtures and contain no production secret.

## Manifest and Metadata Strategy

- Reuse product name, descriptions, URLs, icons, privacy links, and capability summaries from Tool 06 where formats overlap.
- Maintain host-only metadata in the host adapter directory.
- Add schema validation and deterministic generation.
- Fail CI when documented tools, scopes, or endpoints drift from remote MCP introspection.
- Include semantic adapter version, required gateway version, and research schema compatibility range.
- Keep store listing copy separate from functional prompts and commands.

## Authentication and Tenant Isolation

- Remote adapters use Tool 02 OAuth/OIDC and tenant-entitlement enforcement.
- Local Cursor mode accepts credentials through host secret/env facilities.
- Never pass a TNL credential as model-visible prompt text.
- Bind saved research resources to the authenticated principal and tenant.
- Reject cross-tenant IDs even when a user supplies a valid-looking resource URL.
- Test logout, revocation, account switching, shared machines, and token expiry.
- Use least-privilege scopes per research capability.

## Safety and Trust

- Tool descriptions must not imply guaranteed accuracy, real-time completeness, or investment advice.
- Automated research is attributed to TNL Bot with the stable methodology/profile link.
- Claims retain citations, `asOf`, confidence, and fact/inference classification.
- Prompt-injection defenses remain server-side and cannot be disabled by host prompts.
- Adapter logs exclude prompt bodies, credentials, full source content, and private workspace text by default.
- Workspace context is opt-in and constrained to the user-selected content.
- Destructive or account-changing operations are excluded from the initial adapters.

## User Experience Requirements

- Commands use action-oriented names and short descriptions.
- Ask only for missing task inputs that materially change the research result.
- Show progress stages without exposing hidden reasoning.
- Always provide cancel and retry behavior where the host permits it.
- Distinguish authentication, entitlement, rate-limit, data-unavailable, partial, and internal errors.
- Do not present a marketing landing page in the primary app surface.
- Ensure result text, citations, controls, and evidence views remain readable on narrow host panels.

## Local Development and Test Strategy

1. Build shared packages and install local tarballs into each adapter fixture.
2. Use the Tool 01 mock TNL API/MCP for deterministic results.
3. Use the Tool 02 local identity stub for OAuth and tenant tests.
4. Serve the Tool 05 research UI locally with fixture-backed results.
5. Install Tool 06 artifacts into clean client profiles.
6. Use opt-in staging only for tests that require a vendor-hosted callback or review surface.
7. Record manual test evidence when a host cannot be automated; do not claim it as automated coverage.

## Test Matrix

### Shared Contract Tests

- Command-to-research-task mapping.
- Capability and version negotiation.
- Result fallback rendering and citations.
- Error mapping and recovery guidance.
- Privacy-safe telemetry payloads.

### Host Integration Tests

- Clean install, first authorization, successful workflow, restart, upgrade, and uninstall.
- Local and remote modes where supported.
- Rich UI and text-only fallback.
- Multiple accounts and tenant isolation.
- Client version at the minimum supported boundary and the current stable release.

### Negative Tests

- Missing/expired credential.
- User denies OAuth scope.
- Gateway unreachable or rate-limited.
- Tool unavailable due to entitlement.
- Research finishes partially or fails a grader.
- Unrelated prompt that should not trigger TNL.
- Prompt asking for unsupported autonomous trade execution.
- Malicious external source attempting tool instruction injection.

### Review Evidence

- Screen recording or screenshots of installation and core workflows.
- Exact test account/fixture instructions.
- Privacy, security, support, and deletion URLs.
- Tool and scope inventory.
- Known limitations and fallback behavior.
- Compatibility versions and qualification date.

## Observability

- Correlate host request, OAuth principal, MCP request, research task, and result using privacy-safe IDs.
- Measure authorization failures, capability mismatch, workflow completion, partial-result rate, and latency by host.
- Separate adapter defects from gateway and research-service failures.
- Alert on manifest/runtime drift and abnormal authorization failure rates.
- Provide feature flags by host, adapter version, skill, and tenant.

## Implementation Order

1. Verify current official Cursor and OpenAI integration specifications.
2. Freeze shared adapter interfaces and compatibility policy.
3. Implement shared task builders, result rendering, and error mapping.
4. Build the Cursor adapter against local Tool 06 artifacts.
5. Qualify Cursor local and remote modes in clean profiles.
6. Build the OpenAI adapter against the Tool 02 gateway and Tool 05 UI.
7. Add schema, OAuth, UI fallback, and negative-prompt tests.
8. Generate review metadata and evidence artifacts.
9. Run cross-host security, privacy, accessibility, and uninstall tests.
10. Freeze release candidates for Tool 10 without marketplace submission.

## Validation Commands

The implementation must provide commands equivalent to:

```bash
pnpm build
pnpm test
pnpm test:adapters:contracts
pnpm test:adapter:cursor
pnpm test:adapter:openai
pnpm test:adapters:security
pnpm adapters:pack:local
pnpm adapters:review-evidence
```

## Acceptance Criteria

- Both integrations invoke the same typed MCP/research contracts and contain no copied production orchestration.
- Cursor installs from local artifacts and passes local and remote workflows in clean profiles.
- The OpenAI integration passes current official schema, OAuth, tool, UI fallback, and review-fixture checks.
- Authentication, scope, tenant, revocation, and account-switching scenarios are covered.
- Positive workflows return cited, time-aware results; unrelated and disallowed prompts do not trigger unsafe behavior.
- Install, upgrade, disable, and uninstall are documented and validated.
- Review evidence contains no production secrets or private data.
- Release candidates are ready for Tool 10 while external submissions remain unperformed.

## Rollback

- Disable a host adapter independently through gateway allowlists and feature flags.
- Preserve generic MCP access if a richer adapter is withdrawn.
- Retain the previous compatible adapter manifest and bundle.
- Revoke affected OAuth clients without disabling the TNL API.
- Roll back UI resources to structured text/JSON without changing research contracts.

## Completion Gate

This tool is complete only when shared adapter contracts, Cursor and OpenAI integrations, local/remote authentication, host-specific tests, privacy and safety controls, review artifacts, and reversible installation pass qualification against current official platform requirements.

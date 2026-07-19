# TNL Intelligence Cross-Tool Qualification Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository qualification complete; owner publication approval pending
- **Progress:** [`10-cross-tool-qualification-build-progress.md`](10-cross-tool-qualification-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tools 01-09
- **Unblocks:** Publication and production rollout approval

## Objective

Qualify the complete TNL Intelligence tool portfolio as one coherent release system. This phase validates compatibility, security, privacy, reliability, operability, supply chain, documentation, and rollback behavior across SDKs, MCP, webhooks, research, client adapters, automation connectors, and quantitative tooling before any external publication or broad production enablement.

## Required Outcomes

1. A versioned compatibility and support matrix for every tool and shared contract.
2. Cross-tool end-to-end scenarios using only release-candidate artifacts.
3. Security, privacy, abuse, tenant-isolation, and secret-handling evidence.
4. Reliability, load, chaos, recovery, and rollback evidence.
5. Reproducible artifact inventory with checksums, SBOMs, provenance, and license reports.
6. Production runbooks, dashboards, alerts, ownership, and support escalation.
7. A signed release-candidate manifest and explicit go/no-go decision record.
8. Publication remains a separate human-approved action.

## Scope

### Included

- Tools 01-09 and their shared API/schema dependencies.
- Local release artifacts plus approved staging/production canaries.
- Cross-language and cross-host compatibility.
- Functional, security, performance, resilience, accessibility, and documentation validation.
- Operational readiness and rollback rehearsals.
- Release evidence retention and defect disposition.

### Excluded

- Publishing npm/PyPI packages or marketplace listings.
- Creating vendor accounts.
- Production enablement without the required approval gates.
- Adding major new features during qualification.
- Treating test passage as legal, compliance, or financial certification.

## Qualification Principles

- Test built artifacts, not workspace source links.
- Use one traceable release-candidate manifest across all test lanes.
- Fail closed on contract, tenant, secret, and data-integrity defects.
- Separate release blockers from accepted residual risk with named owners and dates.
- Rehearse rollback rather than assume it works.
- Preserve deterministic fixtures while keeping a small opt-in live canary lane.
- Do not weaken tests to make a release candidate pass.

## Release-Candidate Manifest

Create a machine-readable manifest containing:

- Source commit and dirty-state assertion.
- Version of every npm package, Python package, MCP bundle, container, adapter, and connector.
- API, event, research, and dataset schema versions.
- Compatible TNL API/gateway/Codali/Docdex versions or capability ranges.
- Artifact path/URI, SHA-256, size, SBOM, provenance, license report, and scan result.
- Fixture and evaluation dataset versions.
- Qualification environment and toolchain versions.
- Feature flags and default states.
- Migration and rollback identifiers.
- Approval state and evidence index.

The manifest is generated from build outputs and fails if versions or hashes cannot be resolved.

## Compatibility Matrix

### Runtime Dimensions

- Supported Node versions and operating systems.
- Supported Python versions and optional quant dependencies.
- `x64` and `arm64` where relevant.
- Local stdio and remote streamable HTTP MCP transports.
- API-key and OAuth authentication paths.
- Supported Cursor/OpenAI host versions.
- Current n8n, Pipedream, and Zapier validation/runtime versions.

### Contract Dimensions

- TNL REST/API schema.
- MCP tools, resources, prompts, annotations, and protocol version.
- Webhook event envelope and signing version.
- Research task/evidence/claim/result schema.
- Connector operation and trigger output schema.
- Quant observation, mapping, feature, and dataset-manifest schema.

### Compatibility Policy

- Define minimum supported and current tested versions.
- Specify additive versus breaking schema changes.
- Require deprecation windows and observable usage before removal.
- Record known unsupported combinations explicitly.
- Add automated pairwise coverage and risk-based full combinations rather than attempt an impractical full Cartesian matrix.

## End-to-End Scenario Suite

### Scenario 1: SDK and MCP Discovery

1. Install npm tarball and Python wheel in clean consumers.
2. Start the fixture TNL API and local MCP bundle.
3. Authenticate, search intelligence, fetch a stable item, and paginate.
4. Compare normalized outputs across TypeScript, Python, CLI, daemon, and MCP.

### Scenario 2: Hosted MCP Research

1. Authorize through the Tool 02 identity stub or staging OAuth.
2. Invoke a Tool 05 skill through remote MCP.
3. Retrieve TNL, Docdex, and fixture web evidence.
4. Validate result schema, citations, `asOf`, TNL Bot identity, and rich/text fallback.
5. Revoke access and verify the next call fails without cross-tenant residue.

### Scenario 3: Publish to Webhook to Automation

1. Publish a fixture intelligence revision into the outbox.
2. Dispatch a signed Tool 04 event.
3. Receive it through n8n, Pipedream, and Zapier trigger harnesses.
4. Fetch the full structured item and run a bounded research action.
5. Retry and replay the event, confirming deduplication and subscription cleanup.

### Scenario 4: AI Client Workflow

1. Install Tool 06 artifacts and Tool 07 adapter into a clean host profile.
2. Authenticate and run `What Changed?` and `Event Validation` workflows.
3. Inspect citations/evidence UI and text fallback.
4. Exercise rate limit, partial result, logout, upgrade, and uninstall.

### Scenario 5: Quantitative Snapshot

1. Install the Tool 09 wheel and optional extras in a clean environment.
2. Sync fixture revisions including late arrival and retraction.
3. Build a point-in-time snapshot and event panel.
4. Run leakage sentinels and reproduce the dataset manifest.
5. Verify later revisions are absent from the historical view.

### Scenario 6: Degraded Operations

1. Disable Docdex, Codali, web research, queue, or TNL upstream separately.
2. Confirm each client returns the documented partial or unavailable result.
3. Recover the dependency and verify retry/reconciliation behavior.
4. Confirm TNL article publication remains available when downstream tools are disabled.

## Functional Qualification

- Every public operation has success, validation, not-found, unauthorized, forbidden, rate-limited, upstream, timeout, and cancellation coverage where applicable.
- Pagination, cursors, revisions, retractions, filters, and stable IDs agree across tools.
- Rich UI output matches structured fallback semantics.
- Webhook and polling triggers emit equivalent logical events.
- Research skills preserve claim/evidence relationships through clients and connectors.
- Quant loaders preserve the original temporal and revision fields.
- Upgrade and downgrade paths respect documented compatibility ranges.

## Security Qualification

### Authentication and Authorization

- API-key and OAuth issue, use, refresh, rotation, revocation, expiry, and logout.
- Scope and entitlement enforcement at the gateway and downstream services.
- Cross-user and cross-tenant object-ID tests on every resource type.
- Shared-machine and account-switching behavior in clients/connectors.

### Network and Input Security

- SSRF, redirects, DNS rebinding, metadata endpoints, and prohibited ports in webhooks/research retrieval.
- Oversized, malformed, deeply nested, duplicate-key, and invalid-encoding inputs.
- Prompt injection through web pages, TNL text, connector fields, and workspace context.
- TLS validation and clock-skew behavior.

### Secret and Data Handling

- Scan source, generated files, tarballs, wheels, bundles, images, notebooks, logs, traces, screenshots, and support exports.
- Verify secret redaction in errors and diagnostics.
- Validate retention/deletion for research, webhook history, local caches, and saved results.
- Confirm private tenant data never enters shared cache keys, fixtures, or review artifacts.

### Supply Chain

- Dependency vulnerability and license scans.
- SBOM and provenance verification.
- Reproducible or explainably non-reproducible build checks.
- Package archive allowlist and install-script review.
- Container runs non-root with pinned release base image.

## Privacy Qualification

- Map data collected, processed, persisted, transmitted, logged, and exported per tool.
- Verify declared privacy behavior matches runtime traces.
- Confirm workspace context and research prompts are opt-in where required.
- Test deletion and revocation flows from clients through services.
- Ensure automated authorship, source use, external processors, and retention are disclosed.
- Confirm analytics/telemetry contains only approved fields and can be disabled where promised.

## Reliability and Chaos Qualification

Inject controlled failures for:

- TNL API unavailable, slow, malformed, or rate-limited.
- Queue duplication, delay, reorder, and outage.
- Worker crash before and after side effects.
- Docdex index stale/unavailable.
- Codali timeout, tool mismatch, partial evidence, and cancellation.
- OAuth provider latency/revocation.
- Webhook endpoint failure, DNS change, and replay.
- Local storage full, manifest partial write, and interrupted quant sync.
- Client restart during long research.

For every scenario, assert data integrity, bounded retries, useful error state, observability, and recovery without manual database surgery.

## Performance and Capacity Qualification

### Define Service-Level Indicators

- API and MCP latency by operation.
- Research completion and partial-result latency by depth.
- Webhook queue age and time-to-deliver.
- Connector action/trigger latency.
- Quant ingestion throughput, snapshot query time, and peak memory.
- Error, timeout, retry, dead-letter, and cancellation rates.

### Load Profiles

- Baseline, expected peak, burst, and soak.
- Fairness across tenants and API keys.
- High fan-out webhook events.
- Concurrent research with mixed budgets.
- Large paginated sync and dataframe workloads.

Set numeric release thresholds from measured staging baselines and business capacity targets before running the final gate. Record hardware, topology, dataset, concurrency, and test duration with results.

## Accessibility and UX Qualification

- Keyboard navigation, focus order, accessible names, contrast, and screen-reader output for Tool 05 UI.
- Reduced motion and loading/cancellation announcements.
- Desktop, narrow panel, tablet, and mobile viewport checks.
- No text or control overlap in rich MCP/AI client surfaces.
- Structured text fallback contains the same material answer, citations, and warnings.
- Errors distinguish user action from service recovery and avoid exposing internals.

## Documentation Qualification

- Run every quick start from a clean environment.
- Parse and execute code/config snippets where feasible.
- Validate local links and check approved external links.
- Confirm install, authenticate, verify, troubleshoot, upgrade, uninstall, revoke, and delete instructions.
- Ensure examples use placeholders and never real credentials.
- Verify all advertised tools/actions/triggers exist in built artifacts.
- Confirm support, privacy, security, methodology, licensing, and changelog pages are present.

## Operational Readiness

### Ownership

- Assign service and package owners.
- Define primary and secondary incident contacts.
- Map vendor/marketplace issues to an owner.
- Define support response targets and severity levels.

### Dashboards and Alerts

- API/gateway health and authorization failures.
- Research tool/provider failures and grader regressions.
- Webhook queue age, retry, and dead-letter depth.
- Connector and adapter compatibility errors.
- Artifact/version adoption and deprecated-client use.
- Quant sync errors are local by default; document opt-in diagnostics.

### Runbooks

- Credential compromise and OAuth client revocation.
- Bad package/artifact release.
- Gateway outage and provider degradation.
- Webhook backlog and replay.
- Faulty research skill/model version.
- Schema incompatibility.
- Marketplace delisting or urgent metadata correction.
- TNL publication isolation from downstream failures.

## Migration and Rollback Rehearsals

Rehearse:

- MCP server and gateway version downgrade.
- Research skill disable and prior-version restore.
- Webhook dispatcher stop, backlog preservation, and replay.
- Adapter/connector withdrawal with generic MCP/API fallback.
- Quant derived-dataset rebuild under a prior feature version.
- Credential revocation and reauthorization.
- Schema migration rollback or forward-fix procedure.
- Portable repository-state restore for the event outbox and retained research
  results; production datastore recovery remains deployment-owner evidence.

A rollback is not accepted until the service and clients return to a documented stable state and monitoring confirms recovery.

## Defect and Risk Policy

### Release Blockers

- Cross-tenant access or cache bleed.
- Secret leakage.
- Lost committed event or corrupt point-in-time dataset.
- Unsupported material claims/citations above the approved threshold.
- Unbounded retries, cost, memory, or queue growth.
- Missing rollback for a production-enabled component.
- Artifact/runtime metadata mismatch.

### Conditional Acceptance

Lower-severity defects require:

- Written impact and affected versions.
- Workaround and user disclosure where needed.
- Named owner and target date.
- Monitoring or detection plan.
- Explicit approver sign-off.

## Evidence Repository

Store a release-scoped evidence index containing:

- Release-candidate manifest.
- Test reports and environment metadata.
- Security/privacy scan summaries.
- Load and chaos results.
- Accessibility evidence.
- Compatibility matrix.
- Artifact hashes, SBOMs, provenance, and license reports.
- Runbook rehearsal records.
- Known risks and approvals.

Do not commit credentials, private production responses, full restricted source content, or unnecessary personal data into evidence.

## Go/No-Go Gates

1. **Contract gate:** schemas and compatibility matrix pass.
2. **Functional gate:** all mandatory cross-tool scenarios pass from release artifacts.
3. **Security/privacy gate:** no unresolved blocker and required reviews approve.
4. **Reliability gate:** load, chaos, reconciliation, and rollback pass thresholds.
5. **Operations gate:** dashboards, alerts, owners, runbooks, and support are active.
6. **Artifact gate:** provenance, SBOM, scans, versions, and hashes agree.
7. **Documentation gate:** clean-environment guides and marketplace evidence pass.
8. **Business approval gate:** human approval authorizes publication/production rollout.

Failure at any gate returns the candidate to the owning tool plan; it does not get waived by later gates.

## Implementation Order

1. Freeze the release-candidate and evidence schemas.
2. Build compatibility inventory and pairwise matrix.
3. Qualify Tools 01-09 and assemble all local tarballs, wheels, bundles, images,
   adapters, and connectors.
4. Freeze one candidate identity and artifact hash set after all inputs exist.
5. Verify candidate artifacts, then execute the six cross-tool scenarios without
   regenerating component inputs.
6. Run security, privacy, secret, dependency, license, and supply-chain gates.
7. Run performance, load, soak, reliability, and chaos suites.
8. Run browser accessibility workflows before candidate freeze, then verify the
   frozen screenshot hashes and viewport evidence without rewriting artifacts;
   complete documentation qualification.
9. Rehearse migrations, revocations, disable controls, state recovery, and rollback.
10. Resolve blockers and repeat affected gates from a newly frozen candidate.
11. Produce the final evidence index and go/no-go record.
12. Hand the owner-approved release candidate to the separate publication process.

## Validation Commands

The final implementation should expose one aggregate command plus inspectable lanes, equivalent to:

```bash
npm run artifacts:prepare
npm run artifacts:release-candidate
npm run qualify:contracts
npm run qualify:e2e
npm run qualify:security
npm run qualify:privacy
npm run qualify:reliability
npm run qualify:performance
npm run qualify:accessibility
npm run qualify:docs
npm run qualify:release
```

Python artifact, notebook, and point-in-time qualification must run inside the aggregate release gate. The repository's Docdex pre-commit/test workflow must also pass before the evidence manifest is signed.

## Acceptance Criteria

- Every release artifact is installed and tested outside the workspace from the exact hash in the candidate manifest.
- Cross-tool output semantics agree for IDs, timestamps, revisions, events, evidence, citations, and errors.
- Tenant isolation, authentication, secret handling, SSRF, prompt injection, and retention controls pass.
- Load and chaos tests meet documented thresholds and recover without lost committed data.
- Rich UIs and text fallbacks pass accessibility and workflow checks.
- Install, upgrade, revoke, disable, uninstall, migration, and rollback procedures are rehearsed.
- SBOM, provenance, checksums, scans, licenses, documentation, dashboards, alerts, ownership, and risk records are complete.
- A human go/no-go record approves or rejects the exact manifest.
- No package or marketplace publication occurs as an implicit side effect of qualification.

## Completion Gate

Repository implementation is complete when the seven automated technical gates
pass for one immutable release-candidate manifest, all blocker defects are
resolved, rollback is rehearsed, operational ownership artifacts are complete,
and the evidence package is ready for owner review. The candidate becomes
publishable only after the eighth, human-controlled business approval gate passes;
repository qualification never grants that approval implicitly.

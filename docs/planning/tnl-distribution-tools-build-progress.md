# TNL Distribution Tools Build Progress

Date: 2026-07-19
Status: Complete; public GitHub Release and GHCR image published
Plan: [TNL Distribution Tools High-Level Build Plan](tnl-distribution-tools-build-plan.md)

GitHub and GHCR release execution is tracked separately in the
[release plan](tnl-github-ghcr-release-plan.md) and
[release progress trail](tnl-github-ghcr-release-progress.md). npm, PyPI, MCP
Registry, hosted services, and marketplaces remain owner-configuration gates.

## Scope State

- npm and PyPI packages are treated as implementation-ready foundations.
- Public npm/PyPI availability is not required for development or validation.
- Local npm workspaces/tarballs, Python editable installs/wheels, MCPB bundles,
  and container images are the supported development inputs.
- Package and marketplace publication remain owner-controlled work outside this
  implementation progress trail.

## 2026-07-19 Fresh Re-Audit

Status: Complete

| Tool | Fresh finding and disposition                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01   | No gap: clean consumers, local transports, containers, and cleanup remain executable.                                                                                         |
| 02   | Corrected the authorization-server/resource-gateway ownership mismatch; added mock-AS S256 PKCE, refresh rotation, introspection, revocation, and upstream recovery coverage. |
| 03   | No gap: no-account evaluation, credential lifecycle, tenant isolation, limits, and account deletion remain covered.                                                           |
| 04   | Aligned semantic event wording to four canonical event types plus typed change fields; added queue-outage lease recovery and publication/event decoupling coverage.           |
| 05   | Clarified that causal paths belong to exposure/risk and cited briefings are shared result rendering; added isolated TNL, Docdex, web, and all-source degradation coverage.    |
| 06   | No gap: locally packed MCPB, configurations, container evidence, doctor, SBOM, and provenance remain qualified.                                                               |
| 07   | Added executable What Changed and Event Validation client flows with citations, text fallback, partial, rate-limit, and sign-in recovery semantics.                           |
| 08   | No gap: all seven normalized operations, three hosts, trigger parity, lifecycle, and clean candidates remain covered.                                                         |
| 09   | Resolved wording only: six leaf extras plus aggregate `quant` are the seven tested groups.                                                                                    |
| 10   | Wired all new proofs into Scenarios 2, 4, and 6 so final candidate qualification enforces them.                                                                               |

The audit order followed the Docdex impact/DAG review: reconcile shared contracts
and architecture first, add component recovery tests second, add client workflow
evidence third, and run the immutable aggregate candidate gate last.

## Milestone Progress

| Milestone                  | Repository status | Current evidence or next gate                                                    |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| M1 Local-first foundation  | Complete          | Tool 01 clean-consumer, protocol, Python, container, and cleanup gates passed    |
| M2 Hosted platform         | Complete          | Tool 02 gateway and Tool 03 developer onboarding exit gates passed               |
| M3 Research experience     | Complete          | Tool 05 contracts, six skills, orchestration, UI, MCP App, and evaluations pass  |
| M4 AI adapters             | Complete          | Tool 06 artifacts and Tool 07 Cursor/OpenAI adapters are locally qualified       |
| M5 Automation              | Complete          | Tool 08 core, n8n, Pipedream, Zapier, parity, lifecycle, and clean packages pass |
| M6 Quant and qualification | Complete          | Tools 09 and 10 pass artifact, scenario, security, and aggregate qualification   |

## Detailed Planning Artifacts

Planning status is distinct from repository implementation and external
promotion. Every detailed plan and repository exit gate is complete. The final
column is intentionally not inferred from local tests.

| Tool                                      | Detailed plan                                                                                                                                      | Repository | External promotion gate                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| 01 Local integration harness              | [`distribution-tools/01-local-integration-harness-build-plan.md`](distribution-tools/01-local-integration-harness-build-plan.md)                   | Complete   | Not applicable                                                      |
| 02 Remote MCP gateway                     | [`distribution-tools/02-remote-mcp-gateway-build-plan.md`](distribution-tools/02-remote-mcp-gateway-build-plan.md)                                 | Complete   | Deploy with owner IdP/control-plane configuration and TLS           |
| 03 Developer onboarding and sample access | [`distribution-tools/03-developer-onboarding-sample-access-build-plan.md`](distribution-tools/03-developer-onboarding-sample-access-build-plan.md) | Complete   | Deploy public identity, durable stores, billing, and sample service |
| 04 Webhook and event delivery             | [`distribution-tools/04-webhook-event-delivery-build-plan.md`](distribution-tools/04-webhook-event-delivery-build-plan.md)                         | Complete   | Deploy database, queue, KMS, DNS/egress adapters and run canary     |
| 05 Research skills and app                | [`distribution-tools/05-research-skills-app-build-plan.md`](distribution-tools/05-research-skills-app-build-plan.md)                               | Complete   | Connect live TNL/Codali/Docdex/web ports and durable result storage |
| 06 MCP installation artifacts             | [`distribution-tools/06-mcp-installation-artifacts-build-plan.md`](distribution-tools/06-mcp-installation-artifacts-build-plan.md)                 | Complete   | Public GitHub assets and GHCR image published and verified          |
| 07 AI client adapters                     | [`distribution-tools/07-ai-client-adapters-build-plan.md`](distribution-tools/07-ai-client-adapters-build-plan.md)                                 | Complete   | Run live OAuth/host UI canaries and submit approved listings        |
| 08 Automation connectors                  | [`distribution-tools/08-automation-connectors-build-plan.md`](distribution-tools/08-automation-connectors-build-plan.md)                           | Complete   | Register hosts, deploy callbacks, run canaries, and submit listings |
| 09 Quantitative research toolkit          | [`distribution-tools/09-quant-research-toolkit-build-plan.md`](distribution-tools/09-quant-research-toolkit-build-plan.md)                         | Complete   | Run opt-in live data canaries and publish to PyPI                   |
| 10 Cross-tool qualification               | [`distribution-tools/10-cross-tool-qualification-build-plan.md`](distribution-tools/10-cross-tool-qualification-build-plan.md)                     | Complete   | Owner approved GitHub/GHCR; other promotion channels remain gated   |

## Existing Foundation Evidence

| Foundation       | Status | Evidence                                                          |
| ---------------- | ------ | ----------------------------------------------------------------- |
| TypeScript SDK   | Ready  | Strict build and behavioral tests pass                            |
| MCP package      | Ready  | Stdio and guarded HTTP protocol tests pass                        |
| CLI/daemon       | Ready  | Command, event-cache, revision, lock, and daemon tests pass       |
| Python SDK       | Ready  | Ruff, mypy, pytest, wheel, and source build pass                  |
| OpenAPI snapshot | Ready  | Versioned contract and generated types reproduce cleanly          |
| Container        | Ready  | Non-root build, health, and unauthenticated-rejection checks pass |

## Planning Decisions

1. Shared hosted services and contracts are built before marketplace adapters.
2. AI adapters reuse the same skills, evaluation fixtures, and research UI.
3. Automation adapters reuse the same webhook schemas and connector core.
4. n8n and Pipedream precede Zapier; Zapier starts only after webhook behavior is
   proven.
5. Registry publication is not used as an implementation dependency or
   completion signal.
6. Clean local artifact installation is required before a milestone can become a
   publication candidate.

## Validation Evidence

| Check                                | Result             | Evidence                                                                                                                                          |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing repository truth reviewed   | Pass               | Current build plan, progress trail, distribution strategy, package metadata, and Docdex memory reviewed                                           |
| Dependency order established         | Pass               | Local harness -> hosted services -> shared research/event contracts -> adapters -> quant qualification                                            |
| Publication boundary documented      | Pass               | Plan explicitly excludes npm, PyPI, and marketplace publication                                                                                   |
| Local package testing documented     | Pass               | Workspace, tarball, editable install, wheel, MCPB, and container flows included                                                                   |
| Repository package regression tests  | Pass               | `docdexd run-tests --repo .`; 13 TypeScript workspace tests passed                                                                                |
| Markdown formatting                  | Pass               | Prettier check passed for the main plan, progress trail, and ten detailed plans                                                                   |
| Local Markdown links                 | Pass               | All local links validated across the 12 planning documents                                                                                        |
| Detailed child plan coverage         | Pass               | Ten numbered plans cover Tools 01-10 and are linked from the main plan                                                                            |
| Docdex index coverage                | Pass               | Full reindex completed with 83 documents; all ten detailed plans returned direct search hits                                                      |
| Audit implementation tests           | Pass               | Gateway drain, connector result parity, candidate artifacts, cross-tool flow, capacity/chaos, and state recovery are executable                   |
| Tool 01 deterministic API contract   | Pass               | `npm run test:integration`; 2 tests passed                                                                                                        |
| Tool 01 end-to-end harness           | Pass               | `npm run test:harness`; clean npm/Python installs, MCP, CLI, daemon, and containers passed                                                        |
| Tool 01 repository regression        | Pass               | `npm run validate`; formatting, typecheck, 13 tests, and builds passed                                                                            |
| Tool 01 Python regression            | Pass               | Ruff, strict mypy, 7 pytest cases, wheel, and source build passed                                                                                 |
| Tool 01 resource cleanup             | Pass               | No containers, networks, mock processes, images, or temporary consumer roots remain                                                               |
| Tool 02 gateway tests                | Pass               | Mock-AS PKCE/refresh/introspection/revocation, protocol, isolation, quota, upstream recovery, readiness, redaction, and drain pass                |
| Tool 02 shared regressions           | Pass               | 28 workspace tests, strict builds, OpenAPI, formatting, package, audit, and Docdex gates passed                                                   |
| Tool 02 clean consumers              | Pass               | npm tarball, Python wheel/sdist, MCP, CLI, daemon, and evidence scans passed                                                                      |
| Tool 02 gateway container            | Pass               | Dedicated non-root/read-only image passed health/auth and fail-closed production startup checks                                                   |
| Tool 03 onboarding service           | Pass               | Credential lifecycle, tenant isolation, static-only sample data, and enforced sample limits; 9 tests                                              |
| Tool 03 generated contracts          | Pass               | OpenAPI and Postman generation/checks are deterministic and use placeholder-only public assets                                                    |
| Tool 03 clean consumers              | Pass               | Curl, Postman, TypeScript SDK, CLI, MCP, and Python wheel quick starts passed from local artifacts                                                |
| Tool 03 browser and privacy          | Pass               | 1440x900 and 390x844 Playwright flows passed with no overflow, console errors, or persistent key storage                                          |
| Tool 03 shared regressions           | Pass               | `npm run validate`, Tool 01 harness, package audit, pack check, and Docdex tests passed; 37 tests                                                 |
| Tool 03 Docdex coverage              | Pass               | Full reindex completed with 149 documents; impact diagnostics reported no unresolved imports                                                      |
| Tool 04 contracts and helpers        | Pass               | Canonical v1 schema generates TypeScript/Python contracts and one shared signed fixture                                                           |
| Tool 04 security and reliability     | Pass               | Tests cover HMAC/replay, SSRF/DNS rebinding, encryption, isolation, queue-outage outbox recovery, retry, DLQ, and disabled publishing             |
| Tool 04 control plane and load       | Pass               | Challenge-before-activation, lifecycle/history/replay APIs, metrics, and 500 fair deliveries passed                                               |
| Tool 04 clean consumers              | Pass               | Packed npm event package and isolated Python wheel verify the identical canonical fixture                                                         |
| Tool 04 shared regressions           | Pass               | 51 TypeScript and 10 Python tests, pack/audit, Tool 01 containers, and Docdex tests passed                                                        |
| Tool 04 Docdex coverage              | Pass               | Full reindex completed with 187 documents and no unresolved import diagnostics                                                                    |
| Tool 05 research runtime             | Pass               | Six versioned skills, evidence-first orchestration, bounded adapters, TNL Bot identity, causal paths/cited rendering, and per-source outage tests |
| Tool 05 UI and MCP App               | Pass               | Desktop/mobile states, six typed tools, UI/saved resources, JSON fallback, and gateway scope pass                                                 |
| Tool 05 evaluation and security      | Pass               | Eleven evaluation cases cover injection, stale/retracted evidence, insufficiency, budgets, and isolation                                          |
| Tool 05 clean consumers              | Pass               | Packed SDK/research/MCP artifacts, Tools 01/03/04, containers, 67 TypeScript and 10 Python tests pass                                             |
| Tool 05 Docdex coverage              | Pass               | Full reindex completed with 225 documents and no unresolved import diagnostics                                                                    |
| Tool 06 distribution contract        | Pass               | Canonical schema, runtime introspection, and 14 deterministic host/install artifacts agree                                                        |
| Tool 06 bundle and doctor            | Pass               | Reproducible MCPB, clean-profile restart/call/removal, and stable redacted diagnostics pass                                                       |
| Tool 06 container and supply chain   | Pass               | Multi-architecture build, non-root/read-only runtime, SBOM, provenance, and zero high findings pass                                               |
| Tool 06 shared regressions           | Pass               | 71 TypeScript tests, 10 Python tests, pack/audit, and strict repository validation pass                                                           |
| Tool 06 Docdex coverage              | Pass               | Full reindex completed with 257 documents and no unresolved import diagnostics                                                                    |
| Tool 07 shared and gateway contracts | Pass               | Six shared contract tests and 17 gateway identity/research tests pass                                                                             |
| Tool 07 host adapters                | Pass               | Cursor/OpenAI manifests, 12 host skills, clean lifecycle, and executable cited What Changed/Event Validation fallback flows pass                  |
| Tool 07 generated candidates         | Pass               | 32 deterministic assets; extractable Cursor/OpenAI archives and review worksheet generated                                                        |
| Tool 07 external boundaries          | Correctly deferred | Owner/staging UI, app-ID, live-account, and marketplace gates are explicitly not claimed as automated                                             |
| Tool 08 shared connector contract    | Pass               | Seven normalized operations, including research result retrieval, plus signed triggers and polling pass                                           |
| Tool 08 host connectors              | Pass               | n8n runtime 2.30.2, seven Pipedream actions/two sources, and six Zapier creates/one search/two triggers pass                                      |
| Tool 08 parity and lifecycle         | Pass               | Actual host source inspection and behavior tests cover every operation, signature, dedupe, subscribe, and cleanup path                            |
| Tool 08 clean candidates             | Pass               | Eight tarballs plus Zapier upload bundle install cleanly and pass secret/private-path scans                                                       |
| Tool 08 external boundaries          | Correctly deferred | Creator verification, hosted callback canary, registration, upload, and review remain owner gates                                                 |
| Tool 09 point-in-time integrity      | Pass               | Immutable revisions, cursor resume, historical selection, manifests, and ten sentinel classes pass                                                |
| Tool 09 optional engines             | Pass               | Arrow, pandas, Polars, partitioned Parquet, and DuckDB preserve identity and UTC temporal fields                                                  |
| Tool 09 examples and CLI             | Pass               | Six CLI workflows, CC0 fixture, versioned schemas, four notebooks, and paired scripts pass                                                        |
| Tool 09 clean candidates             | Pass               | Reproducible wheel/sdist and all individual/all-extra isolated installs pass security scans                                                       |
| Tool 09 performance                  | Pass               | 5,000-row ingest/snapshot/features stay within bounds at 17.819 MiB peak memory                                                                   |
| Tool 09 external boundaries          | Correctly deferred | Live API/market-data canaries and PyPI publication remain owner-controlled                                                                        |
| Tool 10 candidate contracts          | Pass               | Versioned manifest, evidence index, compatibility matrix, SBOM, provenance, scan, license, and signature                                          |
| Tool 10 cross-tool scenarios         | Pass               | Frozen-candidate scenarios enforce mock-AS hosted research, full AI-client workflows, outbox-to-quant identity, and isolated dependency recovery  |
| Tool 10 security and privacy         | Pass               | Isolation, SSRF, secrets, retention, supply chain, and zero-vulnerability npm production audit pass                                               |
| Tool 10 reliability and rollback     | Pass               | Baseline/peak/burst/soak, retry storm, quota fairness, concurrent research, and eight rollback/recovery rehearsals pass                           |
| Tool 10 accessibility and docs       | Pass               | Four browser viewports, keyboard/focus, reduced motion, fallback parity, guides, and local links pass                                             |
| Tool 10 release decision             | Published          | Seven automated gates pass; owner approved candidate `tnl-rc-1419d34aba032124` for GitHub Release and GHCR                                        |

## Current Blockers

None for repository implementation or GitHub/GHCR publication. npm, PyPI,
hosted services, and marketplaces keep their existing owner configuration
gates.

## Next Implementation Step

No repository or GitHub/GHCR implementation step remains. Other channels
require their separately documented credentials and production environments.

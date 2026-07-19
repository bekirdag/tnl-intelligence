# TNL Intelligence Cross-Tool Qualification Build Progress

- **Date:** 2026-07-19
- **Status:** Repository implementation complete; owner publication approval pending
- **Plan:** [`10-cross-tool-qualification-build-plan.md`](10-cross-tool-qualification-build-plan.md)
- **Parent progress:** [`../tnl-distribution-tools-build-progress.md`](../tnl-distribution-tools-build-progress.md)

## Scope Decisions

- Qualification operates on locally built release-candidate artifacts and never
  publishes a package, image, plugin, connector, or marketplace listing.
- The dirty working tree is allowed for repository qualification, but the
  release-candidate manifest records the commit, dirty assertion, and a digest
  of the candidate source inputs. Human publication approval must target that
  exact manifest digest.
- Existing Tools 01-09 qualification suites remain the source of detailed
  component evidence. Tool 10 adds cross-tool scenarios, compatibility and
  supply-chain inventory, operations and privacy records, and aggregate gates.
- The business approval gate remains owner-controlled. Automated qualification
  must report it as pending and must not convert a technical pass into a
  publication authorization.

## Workstream Progress

| Workstream                            | Status   | Evidence                                                                                                                |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Release manifest and evidence schemas | Complete | Versioned candidate, evidence-index, compatibility, SBOM, provenance, scan, license, and signature contracts            |
| Compatibility inventory and matrix    | Complete | Tested, contract-tested, owner-canary, and unsupported runtime/host combinations are explicit                           |
| Six cross-tool scenarios              | Complete | Frozen artifacts, mock-AS gateway/research, automation-to-quant, full AI workflows, quant, and dependency recovery pass |
| Security and privacy                  | Complete | Tenant, SSRF, secret, retention, dependency, license, SBOM, and provenance checks pass; npm audit is clean              |
| Reliability and performance           | Complete | Baseline/peak/burst/soak, retry storm, quota fairness, concurrent research, and recovery checks pass                    |
| Accessibility and documentation       | Complete | Four viewports, keyboard/focus, reduced motion, fallback parity, clean guides, and link checks pass                     |
| Operations and rollback               | Complete | Owners, support targets, runbooks, and eight rollback/recovery rehearsals are recorded                                  |
| Final evidence and go/no-go           | Complete | Technical decision is `go`; publication remains `no-go-pending-owner`                                                   |

## Initial Dependency Evidence

- Tools 01-09 are repository-complete and have machine-readable evidence under
  `.artifacts/tool-*` where applicable.
- The candidate currently contains npm tarballs, an MCPB, container evidence,
  adapter and connector archives, a Python wheel/sdist, browser screenshots, and
  quantitative benchmark evidence.
- Docdex impact graphs report no indexed inbound or outbound edges for
  `package.json` or the standalone qualification runners, and impact diagnostics
  report no unresolved imports. The qualification scripts can therefore be
  added as leaf orchestration without changing runtime package contracts.
- DAG session `97b8451f-9008-41da-8319-d8fd21fadc84` confirms the release-plan
  search trace used to order work from contracts to scenarios to aggregate gates.

## Validation Trail

| Gate                         | Status        | Evidence                                                                                                           |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Planning/progress loop       | Pass          | Tool plan linked to this separate progress trail before broad implementation                                       |
| Repository dependency review | Pass          | Docdex search, tree, impact graph, DAG export, and diagnostics completed                                           |
| Tools 01-09 frozen evidence  | Pass          | Component qualification runs before candidate freeze; scenario lanes only consume the frozen candidate             |
| Contract and artifact gates  | Pass          | Candidate schemas, hashes, matrix, SBOM, provenance, licenses, and scans pass                                      |
| Cross-tool scenarios         | Pass          | The integrated flow preserves event/story/research identity through three hosts and a point-in-time quant snapshot |
| Security and privacy         | Pass          | Isolation, SSRF, secret, retention, audit, and supply-chain checks pass                                            |
| Reliability and performance  | Pass          | Numeric capacity profiles, chaos scenarios, degraded operation, and eight rollback/recovery checks pass            |
| Accessibility and docs       | Pass          | Browser, fallback, guide, local-link, and advertised-surface checks pass                                           |
| Tool 10 automated gates      | Pass          | Seven technical gates produce a signed technical `go` decision                                                     |
| Human business approval      | Pending owner | Publication remains a separate explicit action                                                                     |

## Resolved Blockers and Constraints

- The initial dependency audit found high-severity transitive findings in the
  n8n and Zapier development trees. The n8n workflow dependency is pinned to
  `2.30.2`, `form-data` is overridden to `4.0.6`, and the final npm production
  audit reports zero vulnerabilities without weakening host validation.
- The first final-freeze attempt correctly rejected a stale technical signature
  left by candidate regeneration. The generator now invalidates the prior
  signature before rewriting the manifest and signs only the new bytes when
  requested; unsigned regeneration, fresh signing, verification, and staleness
  checks all pass.
- The earlier scenario runner regenerated Tool 01-09 artifacts after candidate
  creation and only called isolated qualification commands. Artifact preparation
  now runs first, candidate identity is frozen once, candidate-artifact hashes are
  checked, and the automation scenario passes one event through the outbox,
  n8n/Pipedream/Zapier, research result retrieval, rendering, and the quant lake.
- A fresh criterion audit found that the AI-client scenario only inspected host
  structure and that degraded-operation coverage did not isolate every upstream.
  Scenario 4 now executes What Changed and Event Validation through task building,
  orchestration, citations, fallback, and recovery semantics. Scenario 6 now
  proves TNL upstream recovery, individual TNL/Docdex/web/Codali degradation,
  outbox recovery after queue failure, and publication/event decoupling.
- The same audit found that the Tool 02 plan incorrectly assigned authorization
  server callbacks and token lifecycle to the resource gateway. The plan now
  matches the implementation, and a mock authorization server proves S256 PKCE,
  refresh rotation, introspection, gateway calls, and revocation rejection.
- The first aggregate audit run exposed nondeterministic PNG bytes when
  accessibility browsers were rerun after candidate freeze. Browser workflows
  now run during artifact preparation; the post-freeze accessibility lane checks
  their recorded pass state, exact candidate hashes, PNG format, and six viewport
  dimensions without mutating candidate inputs.
- The Docdex MCP transport reported an expired/unknown session. Required search,
  open, tree, impact, DAG, diagnostics, index, test, memory, and diary operations
  continued through the documented CLI fallback. MCP-only profile and local
  delegation remained unavailable and were treated as an infrastructure defect,
  not silently skipped.
- No repository blocker remains. Owner approval is intentionally required before
  any registry, marketplace, image, connector, or production publication.

## Final Evidence

- Aggregate command: `npm run qualify:release`.
- Candidate evidence: `.artifacts/tool-10/release-candidate.json` and
  `.artifacts/tool-10/evidence-index.json`.
- Capacity/chaos evidence: `.artifacts/tool-10/capacity-chaos-evidence.json`.
- Rollback/recovery evidence: `.artifacts/tool-10/rollback-evidence.json`.
- The final manifest records the exact source digest, dirty assertion, package and
  contract versions, artifact hashes, environment, feature flags, migrations,
  rollback identifier, and all gate states.
- The technical signature verifies manifest integrity. A generated local key is
  an integrity mechanism only and cannot represent owner publication approval.

## Next Gate

The owner may review the exact signed candidate and decide whether to start the
separate publication process. Until that approval is recorded, the enforced
publication decision remains `no-go-pending-owner`.

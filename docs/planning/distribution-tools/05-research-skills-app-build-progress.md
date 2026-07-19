# Tool 05: Research Skills and App Build Progress

Date: 2026-07-19
Status: Repository implementation complete; live services and persistence pending owner action
Plan: [Research Skills and App Build Plan](05-research-skills-app-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                               | Status   | Evidence or next gate                                                                                                |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Research contracts and skill manifests   | Complete | Six immutable manifests pass drift checks; exposure/risk own causal paths and all six share cited briefing rendering |
| Retrieval and Codali adapters            | Complete | TNL-first, Docdex, web, deterministic Codali, disabled, and bounded live HTTP adapter boundaries implemented         |
| Policy, budget, evidence, and caching    | Complete | Budgets, normalization, injection quarantine, tenant cache isolation, and revision invalidation tested               |
| Orchestration and graders                | Complete | Evidence-first orchestration, partial fallback, citations, contradictions, freshness, and safety grading pass        |
| Standalone research application          | Complete | Workspace, evidence, timeline, comparison, impact, details, exports, TNL Bot profile, and all states tested          |
| MCP research and App surface             | Complete | Six typed read-only tools, UI/saved-result resources, JSON fallback, and gateway scope protection pass               |
| Evaluation and security                  | Complete | Six skills plus contradiction, stale, retracted, insufficient, injection, cancellation, and budget cases pass        |
| Clean artifact and browser qualification | Complete | Clean tarball consumer, desktop/mobile Playwright, shared regressions, and secret scans pass                         |

## Current Implementation Decisions

1. Tool 05 will be a shared `@theneuralledger/research` workspace consumed by the standalone app and MCP surface; clients will not copy reasoning logic.
2. Deterministic adapters and versioned fixtures are the default qualification lane. Live Codali, Docdex, and web retrieval remain disabled unless explicit TNL-scoped configuration is supplied.
3. The orchestrator will expose concise provenance and decisions, never hidden chain-of-thought or provider credentials.
4. Every generated result identifies `TNL Bot`, distinguishes fact/inference/forecast/unknown, and links material claims to evidence or marks them unsupported.
5. No implementation or configuration path may read or change BDYA prompts, workloads, or state.

## Validation Evidence

| Check                              | Result | Evidence                                                                                                                            |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tools 01-03 prerequisites          | Pass   | Local artifacts, hosted gateway contracts, and developer onboarding gates passed                                                    |
| Tool 04 integration option         | Pass   | Weekly edition and research completion events can use the stable webhook contract                                                   |
| Repository truth and detailed plan | Pass   | Contracts, six skills, adapters, UI, MCP App, graders, security, operations, and rollback reviewed                                  |
| Impact, symbol, and DAG analysis   | Pass   | Docdex indexed 225 documents, found no unresolved import diagnostics, and exported the change trace DAG                             |
| Contract and orchestration tests   | Pass   | Research tests cover all skills, every individual evidence-source outage, partial synthesis, budgets, isolation, HTTP, and security |
| Browser and MCP App tests          | Pass   | Desktop/mobile workspace states pass; six MCP tools, UI resources, and gateway authorization pass                                   |
| Evaluation thresholds              | Pass   | Eleven deterministic evaluation cases cover all six skills and required adversarial/freshness failure modes                         |
| Clean artifact consumers           | Pass   | Packed SDK, research, and MCP artifacts install and execute without registry access or monorepo imports                             |
| Shared repository regressions      | Pass   | 67 TypeScript and 10 Python tests, strict builds, package audits, Tools 01/03/04, and containers pass                               |

## Current Blockers

None for repository implementation. Real TNL, Codali, Docdex, and approved-web connectivity, durable production persistence, and bounded live canaries remain explicit deployment promotion gates because production credentials are not stored in this repository.

## Next Gate

Connect the live TNL, Codali, Docdex, and approved-web adapters plus durable
tenant-scoped result storage, then run bounded citation and failure canaries.

# TNL Intelligence Research Skills and App Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; live-adapter canaries remain deployment promotion gates
- **Progress:** [`05-research-skills-app-build-progress.md`](05-research-skills-app-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 01 local integration harness, Tool 02 remote MCP gateway, Tool 03 developer onboarding
- **Integrates with:** Existing TNL/Codali research and article-generation capabilities
- **Unblocks:** AI client adapters, quantitative research workflows, cross-tool qualification

## Objective

Build a reusable set of research skills and a focused research application that turn TNL intelligence into cited, inspectable analysis. The implementation must orchestrate existing TNL, Docdex, web-research, and Codali capabilities through stable contracts instead of duplicating the production story-generation pipeline in this repository.

## Required Outcomes

1. Versioned research-task and research-result contracts.
2. Shared skills for change detection, validation, comparison, impact analysis, and weekly consequence review.
3. Evidence-first answers with source attribution, explicit inference, uncertainty, and freshness.
4. A bounded orchestration layer that selects tools, enforces budgets, and records reasoning provenance.
5. A research UI usable as an MCP App and as a standalone authenticated web surface.
6. A repeatable evaluation suite with factuality, citation, freshness, and contradiction checks.
7. Local fixtures and deterministic test modes that do not require published npm or Python packages.
8. Clear separation between automated TNL Bot output and human-authored claims.

## Scope

### Included

- Research request and result schemas.
- Skill definitions, prompts, tool policies, and versioning.
- Retrieval from TNL API/MCP, remote Docdex indexes, and approved web research.
- Codali orchestration through an explicit service boundary.
- Evidence normalization, citation rendering, and contradiction handling.
- Timeline, source comparison, impact path, and asset-exposure views.
- MCP App resources/tools and a standalone web application.
- Evaluation datasets, graders, traces, budgets, and operations.

### Excluded

- Replacing TNL's production article-generation service.
- Implementing another general web crawler or vector database.
- Autonomous trading or personalized financial advice.
- User-facing claims without retrievable evidence.
- Changes to BDYA workflows or shared production prompts.
- Marketplace submission or public hosting before qualification.

## Product Principles

- **Evidence before prose:** collect and normalize supporting material before synthesis.
- **Stable claims:** each factual claim must link to one or more evidence items or be labeled as inference.
- **Time-aware analysis:** distinguish event time, publication time, retrieval time, and revision time.
- **Bounded autonomy:** every research run has tool, time, token, source, and cost limits.
- **Inspectability:** users can expand the evidence and understand why the result was produced.
- **No false certainty:** conflicting, stale, or insufficient evidence remains visible.
- **Thin clients:** business logic lives in shared services and contracts, not in individual editor integrations.

## Architecture

```text
Research UI / MCP client / SDK
              |
       research task API
              |
      policy + budget engine
              |
       Codali orchestrator
       /       |        \
   TNL MCP   Docdex    web research
       \       |        /
       evidence normalizer
              |
       synthesis + graders
              |
     versioned research result
```

The research service receives a typed task, builds a tool plan, gathers evidence, synthesizes a result, runs post-generation graders, and persists only the bounded trace and result data allowed by policy.

## Core Contracts

### Research Task

Required fields:

- Task ID and task type.
- User question or selected TNL intelligence IDs.
- Time window and `asOf` timestamp.
- Optional entities, geographies, categories, assets, and scenarios.
- Desired depth: `brief`, `standard`, or `deep`.
- Source policy and freshness requirement.
- Tool/time/token/cost budget.
- Output format and locale.

### Evidence Item

- Stable evidence ID.
- Source URL or TNL resource ID.
- Source title, publisher, author when known, and retrieved timestamp.
- Event time and publication time when available.
- Exact supporting excerpt within permitted quotation limits or a normalized factual statement.
- Source type, primary/secondary classification, and reliability signals.
- Content hash and revision link.
- Which claims the evidence supports or contradicts.

### Research Claim

- Claim ID and normalized statement.
- Classification: `fact`, `inference`, `forecast`, or `unknown`.
- Supporting and contradicting evidence IDs.
- Confidence with a documented rubric.
- Validity window and freshness state.
- Materiality and impact horizon when applicable.

### Research Result

- Task identity, skill name, and skill version.
- Direct answer and executive summary.
- Claims, evidence, contradictions, unknowns, and assumptions.
- Timeline and impact paths where applicable.
- Citations rendered from evidence IDs.
- Tool trace summary, budgets consumed, and completion reason.
- Automated-output identity: `TNL Bot`, including methodology/profile link.

## Initial Skill Catalog

### 1. What Changed?

- Compare a defined recent window with the prior baseline.
- Group changes by entity and consequence, not only chronology.
- Separate new facts from revisions or repeated coverage.
- Produce a concise answer, evidence timeline, and unresolved questions.

### 2. Source Comparison

- Compare coverage of the same event across primary and secondary sources.
- Identify agreement, omissions, contradictions, framing differences, and timing.
- Avoid declaring a source wrong when evidence is merely incomplete.

### 3. Event Validation

- Resolve the event to a stable TNL identity.
- Seek primary corroboration where available.
- Flag recycled, misdated, weakly sourced, or materially revised claims.
- Return `verified`, `partially_verified`, `disputed`, or `insufficient_evidence` with reasons.

### 4. Asset and Entity Exposure

- Map entities and events to direct and indirect exposures.
- Show the reasoning path and time horizon for each relationship.
- Distinguish documented relationships from model inference.
- Include counterfactors and disconfirming evidence.

### 5. Geopolitical and Operational Risk

- Build scenario-based impact paths across locations, industries, and dependencies.
- State assumptions and leading indicators.
- Avoid point predictions presented as facts.

### 6. Weekly Most Consequential Developments

- Rank the week's developments using a versioned materiality rubric.
- Deduplicate stories into developments.
- Explain consequence, affected entities, evidence, and what to monitor next.
- Produce a structured edition usable by TNL publishing without changing the production format.

The six manifests are the complete initial catalog. Causal impact paths are a
typed result capability used by the exposure and geopolitical/operational-risk
skills, and cited briefing generation is the common `ResearchResult` plus
Markdown/export rendering path used by every skill. They are not separate skills
and must not introduce client-specific orchestration forks.

## Skill Definition Format

Each skill lives in a versioned manifest containing:

- Name, description, owners, and semantic version.
- Supported task and result schema versions.
- Required and optional tools.
- Tool-selection and source policies.
- Prompt templates and output constraints.
- Default and maximum budgets.
- Required graders and pass thresholds.
- Evaluation dataset version.
- Known failure modes and fallback behavior.
- Changelog and deprecation date when replaced.

Prompts must refer to named contract fields rather than rely on free-form parsing. Skill manifests are immutable after release; a behavior change creates a new version.

## Orchestration Workstream

1. Define an adapter interface for TNL retrieval, Docdex retrieval, approved web research, and Codali execution.
2. Discover capabilities at runtime and fail with a useful partial result when a required tool is unavailable.
3. Resolve the user's time window and `asOf` time before retrieval.
4. Retrieve TNL items first for TNL-specific questions, then use Docdex and web sources to corroborate or enrich.
5. Deduplicate evidence by canonical URL, resource ID, content hash, and event identity.
6. Build a claim/evidence graph before drafting prose.
7. Run synthesis with a strict research-result schema.
8. Execute citation, contradiction, unsupported-claim, freshness, and safety graders.
9. Retry only the failed stage within the remaining budget.
10. Return a partial result with explicit incompleteness when limits are reached.

## Codali Integration Boundary

- Call Codali through its supported service or package API; do not shell out from browser code.
- Pin and expose the Codali capability/version used for each run.
- Supply a bounded task capsule, allowed tools, source policy, and output schema.
- Let the TNL production service retain ownership of production article generation.
- Reuse the enhanced research capabilities through shared APIs, not copied prompts.
- Propagate trace IDs while redacting credentials and source bodies.
- Define timeout, cancellation, and degraded-mode behavior for every Codali call.
- Ensure this integration is TNL-scoped and cannot change BDYA configuration or workloads.

## Evidence and Citation Workstream

1. Normalize canonical URLs and source metadata.
2. Preserve separate event, publication, retrieval, and revision timestamps.
3. Record primary versus secondary source classification.
4. Link every material factual claim to evidence IDs.
5. Display contradicting evidence adjacent to the claim it affects.
6. Mark inference and forecast text visually and structurally.
7. Enforce quotation and source-use limits before rendering.
8. Keep citations valid when the presentation order changes.
9. Add a citation export format for Markdown and JSON.
10. Test inaccessible, removed, paywalled, and revised sources.

## Research Application

### Primary Views

- **Research workspace:** question/task controls, progress, cancel, and result.
- **Evidence panel:** source metadata, support/contradiction badges, timestamps, and excerpts.
- **Timeline:** event, publication, and revision points with source grouping.
- **Comparison matrix:** claims by source, agreement state, and missing coverage.
- **Impact paths:** event to entity, sector, asset, geography, and time horizon.
- **Run details:** skill/version, budgets, tools used, completion reason, and warnings.

### Interaction Requirements

- Keep the direct answer and highest-impact evidence visible without an introductory landing page.
- Allow users to start from a question, TNL URL, intelligence ID, entity, or selected time window.
- Provide explicit loading, partial, cancelled, empty, stale, and failed states.
- Preserve a stable URL for an authorized saved result.
- Support keyboard navigation, screen readers, reduced motion, and mobile layouts.
- Do not expose hidden chain-of-thought; show concise tool/evidence provenance and decision summaries.
- Provide copy/export commands for citations and structured results.

### MCP App Surface

- Expose a small set of typed research tools rather than one unrestricted prompt tool.
- Return structured results plus a UI resource for rich inspection.
- Negotiate host capabilities and degrade to text/JSON when the UI resource is unsupported.
- Keep OAuth and tenant context at the remote MCP boundary from Tool 02.
- Validate tool annotations and destructive/read-only semantics.

## TNL Bot Identity and Transparency

- Use `TNL Bot` as the automated author identity for generated research and editions.
- Link to a stable profile explaining source retrieval, synthesis, citations, automated authorship, correction handling, and limitations.
- Record skill and model orchestration versions internally for auditability.
- Never imply direct human reporting or firsthand observation.
- Preserve the TNL article format; enriched sections should use existing content primitives and structured metadata.

## Caching and Freshness

- Cache normalized source metadata by URL/content hash with a bounded freshness policy.
- Cache research results by normalized task, `asOf`, skill version, source-policy version, and input revisions.
- Invalidate affected results when a TNL source is revised or retracted.
- Never answer a recent-window task from cache without checking revision/freshness state.
- Show the result's `asOf` and last-checked time.
- Prevent one tenant's private task or source access from entering another tenant's cache.

## Safety, Privacy, and Security

- Treat web content as untrusted data and isolate it from tool instructions.
- Apply prompt-injection filtering and tool allowlists before Codali execution.
- Do not send credentials, private tenant data, or unpublished content to unauthorized providers.
- Enforce per-tool egress policy and source-domain restrictions.
- Redact secrets and personal data from traces and evaluation artifacts.
- Require authorization for saved research and exports.
- Label financial impact analysis as research, not a trade instruction.
- Provide deletion and retention behavior for saved tasks, traces, and results.

## Local Development Strategy

1. Use Tool 01 to start the mock TNL API/MCP and deterministic research fixtures.
2. Pack npm workspace modules as tarballs and install them into clean UI and MCP consumers.
3. Build Python wheels for any research evaluation or quantitative helpers and install them into clean virtual environments.
4. Provide a fake Codali adapter with deterministic tool plans, latency, failures, and partial results.
5. Support an opt-in live lane using developer-provided credentials without making it the default test path.
6. Store fixture provenance and refresh dates; never silently blend live data into golden tests.

## Evaluation Framework

### Dataset

- Versioned tasks spanning all initial skills.
- Recent and historical windows.
- Straightforward, ambiguous, contradictory, retracted, and insufficient-evidence cases.
- Primary-source-rich and secondary-source-only cases.
- Injection attempts and malicious source content.
- Expected claims/evidence relationships rather than a single prose answer.

### Automated Graders

- Schema validity.
- Citation existence and entailment.
- Unsupported material claim rate.
- Contradiction visibility.
- Time-window and `asOf` correctness.
- Source diversity and primary-source use where available.
- Freshness and revision handling.
- Tool and budget compliance.
- Safety and prompt-injection resistance.

### Human Review

- Consequence ranking quality.
- Clarity and usefulness.
- Calibration of confidence and uncertainty.
- Correct separation of fact, inference, and forecast.
- Whether the evidence panel enables independent verification.

## Observability and Operations

- Metrics: run count, latency by stage, completion state, tool failures, budget use, cache hit rate, and grader failures.
- Traces: task ID, skill/version, tool names, evidence IDs, timing, and normalized decision summaries.
- Alerts: sustained retrieval failure, unsupported-claim regression, citation failure, queue age, and budget anomalies.
- Runbooks: provider outage, Docdex index stale/unavailable, Codali failure, web retrieval degradation, and bad skill release.
- Feature flags: skill availability, live web, provider selection, saved results, and UI rollout.

## Test Strategy

### Contract Tests

- Task, evidence, claim, and result schema compatibility.
- Skill manifest parsing and version pinning.
- MCP tool and UI resource contracts.
- Adapter error and cancellation semantics.

### Integration Tests

- TNL-first retrieval followed by corroboration.
- Remote Docdex search success, empty, stale, and unavailable states.
- Codali tool orchestration and bounded fallback.
- Cache invalidation after TNL revision/retraction.
- UI rendering from completed and partial structured results.

### End-to-End Tests

- Run every skill from a clean locally packed consumer.
- Validate answer, evidence expansion, timeline, exports, and accessibility.
- Exercise remote MCP authentication through a local identity stub.
- Confirm mobile and desktop layouts with screenshot and overlap checks.

### Regression Tests

- Golden claim/evidence graphs for deterministic fixtures.
- Grader thresholds by skill version.
- Prompt and adapter version changes against the full evaluation set.
- No shared-code path changes BDYA behavior.

## Implementation Order

1. Freeze task, evidence, claim, result, and skill-manifest schemas.
2. Implement schema generation, fixtures, and contract tests.
3. Build TNL, Docdex, web, and fake Codali adapters.
4. Implement the budget/policy engine and evidence normalizer.
5. Deliver `What Changed?` and `Event Validation` as vertical slices.
6. Add synthesis and mandatory graders.
7. Build the standalone research workspace and evidence views.
8. Expose the same workflows as typed MCP tools and an MCP App resource.
9. Add the remaining skills and weekly edition output.
10. Integrate the real Codali boundary in a disabled-by-default live lane.
11. Run evaluation, security, accessibility, and performance qualification.
12. Canary inside TNL before enabling saved or externally accessible research.

## Validation Commands

The implementation must expose stable commands equivalent to:

```bash
pnpm build
pnpm test
pnpm test:research:contracts
pnpm test:research:evals
pnpm test:research:e2e
pnpm test:research:security
pnpm artifacts:local
```

Any Python graders or notebooks must also pass the isolated wheel checks defined by Tool 01.

## Acceptance Criteria

- All initial skills return schema-valid results with explicit `asOf`, evidence, citations, uncertainty, and completion state.
- Material factual claims meet the agreed citation-entailment threshold on the versioned evaluation set.
- Contradictory and insufficient evidence remains visible instead of being smoothed into a confident answer.
- The UI renders completed, partial, stale, cancelled, and failed results accessibly on desktop and mobile.
- MCP hosts receive structured text/JSON even when rich UI resources are unavailable.
- Tool, token, time, source, and cost budgets are enforced and observable.
- Real Codali integration is TNL-scoped and leaves BDYA behavior unchanged.
- Clean local consumers work from tarballs and wheels without registry publication.

## Rollout and Rollback

### Rollout

1. Run deterministic fixtures and evaluation only.
2. Enable live retrieval for internal users with saved results disabled.
3. Canary two skills and inspect grader failures.
4. Enable the research UI, then MCP App resources.
5. Add remaining skills and weekly-edition integration incrementally.

### Rollback

- Disable individual skill versions or providers through feature flags.
- Fall back to a structured TNL-only result when external research is unavailable.
- Invalidate a faulty skill version's cache without deleting source evidence.
- Preserve the prior stable schema and skill version for active clients.
- Stop live Codali execution independently of TNL publication.

## Completion Gate

This tool is complete only when every initial skill, the evidence-first orchestration service, the standalone and MCP App interfaces, the evaluation framework, production operations, and rollback controls pass qualification with no regression to existing TNL or BDYA generation flows.

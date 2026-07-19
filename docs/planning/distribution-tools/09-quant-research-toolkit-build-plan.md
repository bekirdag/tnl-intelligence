# TNL Intelligence Quantitative Research Toolkit Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; PyPI publication deferred
- **Progress:** [`09-quant-research-toolkit-build-progress.md`](09-quant-research-toolkit-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 01 local integration harness, Tool 03 developer onboarding, Tool 05 research contracts
- **Unblocks:** Reproducible event research and final release qualification

## Objective

Build a Python-first quantitative research toolkit that converts TNL intelligence into point-in-time datasets, event-study inputs, exposure features, and reproducible notebooks. It must make temporal assumptions explicit, prevent common look-ahead errors, preserve revisions and provenance, and remain a research tool rather than a trading system.

## Required Outcomes

1. Typed Python models and loaders for TNL intelligence, revisions, events, entities, assets, and research evidence.
2. Point-in-time dataset builders with explicit event, publication, availability, and retrieval timestamps.
3. Local Parquet/DuckDB storage and deterministic snapshot manifests.
4. Event-window, exposure, novelty, materiality, and revision-aware feature utilities.
5. Look-ahead, survivorship, timezone, and duplicate-event safeguards.
6. Reproducible example notebooks and command-line workflows.
7. Isolated wheel/sdist tests using local artifacts, with optional dependency groups.
8. Clear data licensing, attribution, retention, and financial-research limitations.

## Scope

### Included

- Python client extension or companion `quant` package.
- Schema-normalized ingestion from TNL API/files.
- Incremental local lake and snapshot manifests.
- Entity/asset resolution interfaces and mapping tables.
- Event-study panel construction and feature engineering.
- Integration adapters for pandas, Polars, PyArrow, and DuckDB where optional dependencies are installed.
- Notebook templates and deterministic sample datasets.
- Validation, leakage sentinels, benchmarks, and documentation.

### Excluded

- Brokerage connectivity or order execution.
- Portfolio recommendations or production alpha claims.
- Redistribution of third-party source content beyond licensing rights.
- A hosted backtesting platform.
- Mandatory heavyweight dataframe dependencies in the base API client.
- Publishing to PyPI during implementation.

## Research Integrity Principles

- Every row has an explicit `asOf`/availability boundary.
- Publication time is not assumed to equal event time.
- Later revisions cannot silently replace historical observations.
- Stable identifiers and raw provenance are retained alongside derived features.
- Convenience functions fail on ambiguous timezones, ordering, or identifier collisions.
- Examples distinguish explanatory research from forward-test evidence.
- Automated classifications preserve confidence and inference labels.

## Package Strategy

Choose one of these after inspecting the current Python package boundary:

1. Preferred: add an optional `quant` module and extras to the existing Python SDK when ownership and versioning align.
2. Alternative: create a companion package depending on the local SDK wheel when dependency weight or release cadence needs isolation.

In either case:

- Keep the base TNL client lightweight.
- Use optional extras such as `quant-pandas`, `quant-polars`, `quant-duckdb`, and `notebooks` or a smaller equivalent set.
- Avoid importing optional libraries at module import time when their feature is unused.
- Provide precise missing-extra errors.
- Test the minimum and current supported versions of optional dependencies.

## Canonical Temporal Model

Every intelligence observation must preserve:

- `event_time`: when the underlying real-world event occurred, if known.
- `source_published_at`: when a cited source first published the information.
- `tnl_published_at`: when TNL made the observation available.
- `tnl_revised_at`: when a specific revision became available.
- `retrieved_at`: when the client fetched it.
- `available_at`: the timestamp used by a point-in-time analysis after configured latency rules.
- `as_of`: the dataset boundary that excludes information unavailable at that time.

All timestamps are timezone-aware UTC internally. Display-time conversion never changes ordering semantics.

## Canonical Data Models

### Intelligence Observation

- Intelligence ID and revision ID.
- Event identity and event type.
- Headline/summary fields permitted for the selected access tier.
- Category, geography, language, and consequence metadata.
- Entities, assets, relationships, impact direction, horizon, confidence, and materiality.
- All temporal fields from the canonical temporal model.
- Retraction/correction state.
- Provenance and canonical TNL URL.

### Entity and Asset Mapping

- Stable TNL entity ID.
- Identifier namespace and value, such as ticker, ISIN, LEI, FIGI, or internal symbol.
- Valid-from and valid-to timestamps.
- Mapping source and confidence.
- Relationship type and direct/indirect classification.
- Corporate-action and symbol-change references.

### Dataset Manifest

- Dataset ID, creation time, and `asOf` boundary.
- Query/filter specification and TNL API/schema versions.
- Source cursors and revision watermark.
- File list, row counts, column schemas, and hashes.
- Timezone and latency policy.
- Entity-map version and feature-definition versions.
- Licensing/access tier and redistribution restrictions.

## Ingestion Workstream

1. Stream paginated TNL results through the SDK rather than load all data into memory.
2. Normalize each response to the canonical models and validate timestamps.
3. Store raw normalized observations as immutable revisions.
4. Maintain a current-view index separately from revision history.
5. Use stable cursor/watermark checkpoints for incremental sync.
6. Handle late-arriving items, retractions, corrections, and duplicated API pages.
7. Write partitioned Parquet with deterministic schema and compression settings.
8. Register local DuckDB views without requiring a separate database service.
9. Produce a manifest only after all files and hashes are complete.
10. Support resume after interruption without publishing a partial snapshot as complete.

## Point-in-Time Query Workstream

Provide APIs such as:

- `snapshot(as_of=..., filters=...)`
- `history(intelligence_id=...)`
- `changes(since=..., until=...)`
- `events(as_of=..., available_before=...)`
- `entity_exposure(entity=..., as_of=...)`

Behavior requirements:

- Select the latest revision whose `available_at <= as_of`.
- Exclude later retractions/reclassifications unless the query explicitly asks for hindsight/current state.
- Make hindsight mode opt-in and visibly labeled.
- Reject naive datetimes.
- Return manifest and policy metadata with each materialized dataset.
- Permit both lazy query and materialized output where the backend supports it.

## Feature Workstream

### Event Features

- Novelty versus recent related events.
- Materiality and consequence rank.
- Confidence and source corroboration counts.
- Revision count and revision direction.
- Category, geography, entity, and event-type encodings.
- Time since event/source/TNL publication.

### Exposure Features

- Direct and indirect entity/asset relationships.
- Impact direction, confidence, and horizon.
- Graph-distance or relationship-path summaries where the contract provides them.
- Exposure decay by configurable time horizon.
- Contradictory or uncertain exposure flags.

### Aggregations

- Count, weighted count, novelty, and materiality by time bucket.
- Entity/asset/category/geography panels.
- Rolling windows that use `available_at`, never future revisions.
- Cross-sectional ranking with explicit universe and missing-data rules.

Feature definitions must be versioned, deterministic, documented, and stored in dataset manifests.

## Event Study Utilities

1. Align TNL events to an external market/calendar index supplied by the user.
2. Apply configurable publication-to-tradable latency.
3. Assign events to sessions with explicit market timezone/calendar.
4. Construct pre-event, event, and post-event windows.
5. Support multiple events per entity/session with documented overlap policy.
6. Join returns or outcomes supplied by the user; do not bundle unlicensed market data.
7. Calculate descriptive abnormal outcomes only when the user supplies a benchmark/model.
8. Return sample counts, exclusions, missingness, and confidence intervals.
9. Label exploratory and out-of-sample periods.
10. Export the exact event selection and exclusion manifest.

## Leakage and Bias Sentinels

The toolkit must detect or fail on:

- A feature timestamp later than its observation's `asOf`.
- Use of latest revision in a historical snapshot.
- Naive or mixed timezone comparisons.
- Entity mappings not valid at the observation time.
- Outcome data entering feature construction.
- Backfilled events treated as contemporaneously available.
- Survivorship-only universes without an explicit override.
- Duplicate event/resource IDs after joins.
- Train/test time overlap or randomized temporal splits in guarded workflows.
- Silent forward-fill across unavailable periods.

Provide a `validate_point_in_time()` report with machine-readable findings and fail-on-severity controls.

## Dataframe and Storage Adapters

### PyArrow

- Use Arrow schemas as the interchange layer when installed.
- Preserve timezone and nullable types.
- Avoid converting high-volume paths through Python dictionaries unnecessarily.

### pandas

- Return typed DataFrames with documented index behavior.
- Avoid object columns for timestamps and structured values where practical.
- Include conversion tests across supported pandas versions.

### Polars

- Support lazy scans over partitioned Parquet.
- Keep expressions pushdown-friendly for common filters.
- Do not require pandas as an intermediate.

### DuckDB

- Register snapshot paths and curated views.
- Use parameterized queries for values.
- Provide SQL examples for point-in-time and event-window analysis.
- Pin or test schema compatibility across the supported version range.

## CLI Workflows

Provide commands equivalent to:

```bash
tnl-quant sync --since 2026-01-01 --output ./data/tnl
tnl-quant snapshot --as-of 2026-07-01T00:00:00Z --output ./snapshots/july-01
tnl-quant validate ./snapshots/july-01
tnl-quant event-panel --config event-study.yaml --output ./derived/panel
tnl-quant manifest ./derived/panel
```

Requirements:

- Config can be supplied as versioned YAML/JSON with schema validation.
- Credentials come from environment/secret inputs and are never written to config output.
- Commands support dry-run and structured JSON summaries.
- Partial outputs use temporary paths and are promoted atomically.
- Exit codes distinguish validation, authorization, upstream, and local storage failures.

## Notebook Set

### 1. Point-in-Time Dataset Quick Start

- Install from a locally built wheel.
- Load deterministic sample data.
- Build and validate a historical snapshot.
- Inspect revisions and availability timestamps.

### 2. Event Study Template

- Load user-supplied example outcome data with a permissive local fixture license.
- Apply a market calendar and latency policy.
- Build windows, exclusions, and descriptive results.
- Demonstrate leakage sentinels.

### 3. Entity and Asset Exposure

- Build a time-aware exposure panel.
- Inspect direct, indirect, uncertain, and contradictory relationships.
- Aggregate by horizon without presenting a trade recommendation.

### 4. Weekly Consequence Dataset

- Retrieve or load weekly ranked developments.
- Compare ranking, coverage, and exposure changes over time.
- Preserve evidence and TNL Bot attribution.

Every notebook must execute top-to-bottom in a clean environment and have a paired non-interactive test.

## Sample Data

- Include a small deterministic dataset generated from synthetic or redistributable fixtures.
- Preserve the production schema shape without containing production credentials or restricted source text.
- Include revisions, retraction, late arrival, ambiguous entity mapping, and timezone edge cases.
- Version the dataset and record generation provenance.
- Never market sample results as live performance evidence.

## Performance Requirements

- Stream API pages and Parquet writes to bound memory use.
- Benchmark ingestion, snapshot selection, common filters, and panel construction.
- Define reference hardware and dataset sizes for published benchmarks.
- Test at a scale above the initial sample and expected developer use.
- Prevent accidental quadratic joins and unbounded graph expansion.
- Expose progress and cancellation for long CLI operations.

## Security, Licensing, and Compliance

- Never persist API keys in manifests, notebooks, cell output, shell history examples, or logs.
- Respect TNL access tiers and per-field redistribution rules.
- Store canonical links and attribution required by the TNL license.
- Do not redistribute third-party article bodies or market datasets.
- Provide retention and deletion commands for local caches.
- Label the toolkit as research infrastructure, not financial advice or an execution system.
- Document user responsibility for external data licenses and regulated use.

## Local Build and Test Strategy

1. Build wheel and sdist from the workspace.
2. Install each artifact into a new virtual environment with no editable installs.
3. Test base dependencies, each optional extra, and the all-extras combination.
4. Use the Tool 01 mock TNL API and deterministic fixtures by default.
5. Execute notebooks non-interactively in isolated environments.
6. Run compatibility tests for supported Python and optional-library versions.
7. Keep live TNL tests opt-in, read-only, quota-bounded, and excluded from golden outputs.

## Test Strategy

### Unit Tests

- Model/schema validation.
- Timestamp and availability calculation.
- Revision selection and current-view logic.
- Cursor checkpoints and atomic manifests.
- Feature definitions and leakage sentinels.

### Property Tests

- Historical snapshots never include later availability timestamps.
- Incremental sync plus resume equals a clean full sync for the same fixture.
- Duplicate/reordered pages do not change the final manifest.
- Dataframe adapters preserve row identity and temporal fields.

### Integration Tests

- API to Parquet/DuckDB snapshot pipeline.
- Retraction and late-revision handling.
- Entity-map validity windows.
- Wheel installation with optional extras.
- CLI JSON output, exit codes, interruption, and resume.

### Reproducibility Tests

- Identical fixture/config/version inputs produce identical logical data and manifest hashes.
- Notebooks execute without hidden state.
- Feature version changes create a new manifest identity.
- Benchmark results include environment and dependency versions.

## Implementation Order

1. Inspect the Python SDK boundary and choose module versus companion-package ownership.
2. Freeze temporal, observation, mapping, and manifest schemas.
3. Implement streaming ingestion and immutable revision storage.
4. Implement point-in-time snapshot queries and leakage sentinels.
5. Add Parquet/DuckDB and dataframe adapters behind optional extras.
6. Implement versioned event/exposure features.
7. Build event-window and panel utilities.
8. Add CLI workflows and atomic manifests.
9. Produce deterministic sample data and notebooks.
10. Run isolated wheel/sdist, compatibility, reproducibility, and performance tests.
11. Freeze local artifacts and evidence for Tool 10 without PyPI publication.

## Validation Commands

The implementation must provide stable commands equivalent to:

```bash
python -m build
python -m pytest
python -m pytest tests/quant
python -m pytest tests/point_in_time
python -m pytest tests/notebooks
python -m pytest tests/package_install
tnl-quant validate tests/fixtures/snapshot
```

Use the Tool 01 Docdex test wrapper and clean-environment artifact runner for recorded qualification evidence.

## Acceptance Criteria

- Historical snapshots select only revisions available at the requested `asOf` under the configured latency policy.
- Leakage sentinels catch all documented future-data, timezone, mapping, duplicate, and split violations.
- Incremental sync handles duplicates, late arrivals, corrections, retractions, interruption, and resume deterministically.
- pandas, Polars, Arrow, and DuckDB paths preserve the canonical temporal and identifier fields when their extras are installed.
- Every notebook executes in a clean environment from a locally built wheel.
- Dataset manifests capture query, versions, policies, files, schemas, hashes, and licensing metadata.
- No package, fixture, notebook, or output contains credentials or restricted third-party content.
- Documentation makes clear that the toolkit supports research and does not execute or recommend trades.

## Rollback

- Keep prior schema and feature versions readable.
- Do not rewrite immutable local revisions during an upgrade.
- Rebuild derived datasets when a feature implementation is withdrawn.
- Provide manifest migration as an explicit command, never an automatic silent rewrite.
- Retain a base SDK path if optional quant dependencies fail.

## Completion Gate

This tool is complete only when point-in-time ingestion, storage, queries, features, leakage safeguards, CLI workflows, notebooks, optional adapters, artifact-install tests, licensing controls, and reproducibility evidence pass qualification.

# TNL Intelligence Quantitative Research Toolkit Build Progress

- **Date:** 2026-07-19
- **Status:** Repository implementation complete; live canaries and PyPI promotion pending owner action
- **Plan:** [`09-quant-research-toolkit-build-plan.md`](09-quant-research-toolkit-build-plan.md)
- **Parent progress:** [`../tnl-distribution-tools-build-progress.md`](../tnl-distribution-tools-build-progress.md)

## Scope Decisions

- The toolkit is an optional `tnl_intelligence.quant` module in the existing
  Python distribution so its schemas and client version stay aligned.
- The base SDK remains `httpx`-only. Arrow, pandas, Polars, DuckDB, YAML, and
  notebook dependencies are installed through explicit optional extras and are
  imported lazily.
- Immutable normalized JSONL revisions are the dependency-light source of
  truth. Parquet and DuckDB are optional materializations.
- All internal timestamps are timezone-aware UTC. Historical snapshots select
  only revisions whose configured `available_at` is at or before `as_of`.
- The package is research infrastructure. It does not contain brokerage,
  execution, recommendations, live market data, or production performance
  claims.

## Workstream Progress

| Workstream                              | Status   | Evidence or next gate                                                                                 |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Package boundary and optional extras    | Complete | Base stays `httpx`-only; six lazy leaf extras plus the aggregate `quant` group pass isolated installs |
| Canonical models and temporal policy    | Complete | Typed UTC observations, mappings, policies, files, and manifests are stable                           |
| Immutable ingestion and snapshots       | Complete | Per-revision files, cursor resume, dedupe/collision checks, and atomic manifests pass                 |
| Leakage and bias sentinels              | Complete | Ten future, revision, timezone, mapping, outcome, universe, split, and fill classes covered           |
| Optional storage and dataframe adapters | Complete | Arrow, pandas, Polars, partitioned Parquet, and DuckDB round trips pass                               |
| Versioned features and event studies    | Complete | Indexed event/exposure features and user-outcome session windows pass                                 |
| CLI workflows                           | Complete | Sync, snapshot, validate, event-panel, manifest, and purge exit behavior pass                         |
| Synthetic dataset and notebooks         | Complete | CC0 edge-case fixture and four paired clean-kernel notebooks pass                                     |
| Isolated package qualification          | Complete | Reproducible wheel/sdist, per-extra, all-extra, benchmark, and audit pass                             |
| Documentation and evidence freeze       | Complete | Guide, schemas, licensing/retention policy, hashes, and Tool 10 handoff recorded                      |

## Required Validation

| Gate                                            | Status | Evidence                                                                                         |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Ruff and strict mypy                            | Pass   | 24 source modules pass Ruff format/lint and strict mypy                                          |
| Python unit/property/integration tests          | Pass   | 30 quant tests and 40 full Python tests pass                                                     |
| Optional adapter preservation                   | Pass   | UTC types and row identity preserved through Arrow, pandas, Polars, Parquet, and DuckDB          |
| CLI and atomic-output behavior                  | Pass   | Structured output, dry-run, cursor resume, config version, hashes, and exit classes tested       |
| Notebook execution without hidden state         | Pass   | Four notebooks execute from empty kernels in workspace and wheel environments                    |
| Deterministic manifests and sample data         | Pass   | Reordered/resumed inputs and regenerated CC0 assets produce identical logical output             |
| Clean wheel/sdist installs                      | Pass   | Base wheel/sdist, six individual extras, and all extras install without editable/workspace links |
| Credential/private-path/restricted-content scan | Pass   | Both archives pass path, credential, cache, and restricted-body scans                            |
| Performance bound                               | Pass   | 5,000 rows: ingest 3.847s, snapshot 2.057s, features 0.120s, peak 17.819 MiB                     |
| Shared repository regression                    | Pass   | Docdex wrapper ran all TypeScript workspace suites; 40 Python tests also pass                    |
| Docdex index and impact diagnostics             | Pass   | 416 documents indexed; zero unresolved import diagnostics                                        |

## Frozen Evidence

- Qualification digest:
  `f77ad179da2fb5b6bf5e7ff6d3103a86fd6a867e883bb4f82b7ac73b8c4726b2`
- Wheel SHA-256:
  `2dc7d5f6352ae4ab0ef1bf3c703b1909b84819020ee84e58228b1496f6e0d7fa`
- Source distribution SHA-256:
  `227460727fe80721a485c9519c1f29796b310eee96dab2f0f570f089adbdb8cf`
- Machine-readable evidence:
  `.artifacts/tool-09/qualification-evidence.json`
- Benchmark evidence: `.artifacts/tool-09/benchmark.json`

## Residual Boundaries

- The configured Docdex MCP transport returns `unknown or expired MCP session`.
  CLI search, open, graph, DAG, index, test, memory, and diary fallbacks are in
  use; profile writes and MCP-only local delegation remain unavailable.
- Python 3.10-3.13 and minimum dependency compatibility remain part of the Tool
  10 CI matrix; local qualification used Python 3.14.6 and current optional
  engines.

## External Boundaries

- PyPI publication is owner-controlled and is not part of this implementation.
- Live TNL API and licensed market-data tests remain opt-in and read-only.

## Next Gate

Run opt-in read-only live TNL and licensed market-data canaries, then publish the
exact qualified wheel/sdist only after owner approval.

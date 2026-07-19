# Quantitative Research Toolkit

The optional `tnl_intelligence.quant` module turns TNL intelligence into
revision-aware, point-in-time research datasets. It is research infrastructure,
not a broker, order router, recommendation engine, or source of licensed market
data.

## Installation

The base Python SDK remains lightweight. Install only the engines a workflow
uses:

```bash
python -m pip install 'tnl-intelligence[quant-arrow]'
python -m pip install 'tnl-intelligence[quant-pandas]'
python -m pip install 'tnl-intelligence[quant-polars]'
python -m pip install 'tnl-intelligence[quant-duckdb]'
python -m pip install 'tnl-intelligence[quant-cli]'
python -m pip install 'tnl-intelligence[notebooks]'
```

`quant` installs Arrow, pandas, Polars, DuckDB, and YAML support. Combine
`quant,notebooks` for the complete local research environment. Optional modules
are imported lazily; importing the base SDK does not load them.

During repository development, build and install the local artifact instead of
depending on PyPI:

```bash
cd python/tnl_intelligence
python -m build
python -m pip install 'dist/tnl_intelligence-0.1.0-py3-none-any.whl[quant,notebooks]'
```

## Temporal Contract

Every observation distinguishes:

- `eventTime`: when the underlying event occurred, if known.
- `sourcePublishedAt`: when cited evidence was first published.
- `tnlPublishedAt`: when TNL published the observation.
- `tnlRevisedAt`: when that correction or revision was published.
- `retrievedAt`: when this client first fetched the immutable revision.
- `availableAt`: the research boundary after the selected latency policy.
- `asOf`: the dataset boundary that excludes later information.

All timestamps must be timezone-aware and are normalized to UTC. Historical
mode calculates availability from TNL publication or revision time. Observed
mode conservatively uses the later of TNL availability and local retrieval.
Hindsight selection is opt-in and is labeled in the manifest.

## Python Workflow

```python
from pathlib import Path

from tnl_intelligence.quant.lake import RevisionLake
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.temporal import parse_utc
from tnl_intelligence.quant.validation import validate_point_in_time

lake = RevisionLake(Path("data/tnl"))
lake.ingest(sample_observations(), checkpoint="synthetic-complete")
snapshot = lake.snapshot(
    as_of=parse_utc("2026-06-08T00:00:00Z"),
    output="snapshots/2026-06-08",
)
report = validate_point_in_time(
    snapshot.observations,
    as_of=snapshot.manifest.as_of,
    backfill_acknowledged=True,
)
assert report.valid
```

The lake writes one immutable normalized file per revision, a separately
replaceable current view, an atomic page cursor, and deterministic snapshots.
Duplicate pages are idempotent. A reused revision identifier with different
substantive content fails rather than rewriting history.

## CLI Workflow

`TNL_API_KEY` is read from the environment only for live sync. It is never
accepted as a visible argument or written to manifests.

```bash
tnl-quant sync --since 2026-01-01 --output ./data/tnl
tnl-quant snapshot \
  --lake ./data/tnl \
  --as-of 2026-07-01T00:00:00Z \
  --output ./snapshots/july-01
tnl-quant validate ./snapshots/july-01
tnl-quant manifest ./snapshots/july-01
tnl-quant purge --lake ./data/tnl --snapshots --yes
```

Use `--retrieval-policy observed` when a historical API fetch must not be treated
as contemporaneously known. Validation fails on marked backfills unless the
operator explicitly passes `--acknowledge-backfill`.

Event panels consume user-supplied sessions and outcomes:

```json
{
  "schemaVersion": "1.0",
  "snapshot": "./snapshots/july-01",
  "sessions": "./inputs/sessions.json",
  "outcomes": "./inputs/outcomes.json",
  "entityAssets": { "entity-id": "LICENSED-SYMBOL" },
  "latencySeconds": 300,
  "pre": 2,
  "post": 5,
  "overlap": "exclude"
}
```

```bash
tnl-quant event-panel --config event-study.json --output derived/panel.jsonl
```

The versioned configuration and manifest schemas are in
[`schemas/quant`](../schemas/quant).

## Storage and Dataframes

- `to_arrow()` preserves UTC timestamps and nullable canonical types.
- `to_pandas()` returns UTC-aware timestamp columns.
- `to_polars()` returns typed columns; `scan_polars()` lazily scans Parquet.
- `write_parquet()` atomically writes one snapshot file.
- `write_partitioned_parquet()` partitions by publication date and category.
- `duckdb_connection()` registers a local Parquet view without a database
  service and still uses parameterized values in consumer queries.

Dataset manifests contain the query, schema/API version, cursor, revision
watermark, file hashes, column types, latency policy, entity-map version,
feature versions, access tier, license, redistribution rule, and hindsight flag.
For reproducibility, `createdAt` equals the materialized `asOf` boundary; the
artifact's filesystem creation time is intentionally not part of its identity.

## Features and Event Studies

Event features include novelty, consequence/materiality, confidence,
corroboration, revision count, and publication lags. Exposure features preserve
mapping validity windows, direct/indirect relationships, direction, horizon,
confidence, decay, uncertainty, and contradiction flags. Definitions are
versioned in every output row.

Event studies align observations to sessions supplied by the user after an
explicit tradability latency. The overlap policy is `keep`, `first`, or
`exclude`. Outcomes and benchmarks are also user-supplied; the toolkit reports
missingness, exclusions, sample counts, descriptive abnormal outcomes, and a
confidence interval. It does not download market data or claim predictive
performance.

## Integrity Validation

`validate_point_in_time()` reports machine-readable findings for:

- observations or features after `asOf`;
- a non-current historical revision for the selected boundary;
- naive or mixed timezone input;
- invalid or ambiguous entity mappings;
- outcome-like columns in features;
- unacknowledged backfills or survivorship-only universes;
- duplicate revisions/events;
- overlapping or randomized temporal splits; and
- silent forward-fill across unavailable periods.

Warnings and errors are retained separately. CLI exit code `3` identifies a
validation failure, `4` authorization, `5` upstream API failure, and `6` local
storage failure.

## Synthetic Examples

The wheel includes four notebooks under
`tnl_intelligence.quant.example_assets/notebooks`:

1. Point-in-time dataset quick start.
2. Event study with user-supplied synthetic outcomes.
3. Time-aware entity and asset exposure.
4. A TNL Bot-attributed weekly consequential developments dataset.

The fixture includes revisions, a retraction, late arrival, an ambiguous
mapping, and a timezone-offset edge. It is CC0 synthetic data with no live TNL
content, credentials, market data, or third-party article text. Every notebook
has a paired function in `tnl_intelligence.quant.examples` and executes from an
empty kernel during qualification.

## Licensing and Retention

- Store only fields permitted by the member's TNL access tier.
- Keep canonical TNL links and required attribution.
- Do not redistribute source article bodies or externally licensed market data.
- Treat entity maps, calendars, outcomes, and benchmarks according to their own
  licenses.
- Use `tnl-quant purge --snapshots --yes` for derived outputs or `--all --yes`
  for the complete local lake and checkpoint.
- Do not present synthetic notebook results as live or forward-test evidence.

## Qualification

```bash
npm run test:quant
```

This builds reproducible wheel and source artifacts, runs base and quant tests,
installs the base package and every optional extra in separate virtual
environments, executes all notebooks from the built wheel, scans archives for
credentials/private paths/restricted fixtures, and records a bounded benchmark
under `.artifacts/tool-09`.

from __future__ import annotations

import tempfile
from datetime import timedelta
from pathlib import Path

from .event_study import MarketSession, build_event_panel
from .features import aggregate_exposure, event_features, exposure_features
from .lake import RevisionLake
from .sample import sample_mappings, sample_observations, sample_outcomes, sample_sessions
from .temporal import parse_utc
from .validation import validate_point_in_time

EXAMPLE_AS_OF = parse_utc("2026-06-08T00:00:00Z")


def point_in_time_example(work_dir: str | Path | None = None) -> dict[str, object]:
    temporary: tempfile.TemporaryDirectory[str] | None = None
    if work_dir is None:
        temporary = tempfile.TemporaryDirectory(prefix="tnl-quant-example-")
        root = Path(temporary.name)
    else:
        root = Path(work_dir).expanduser().resolve()
    try:
        lake = RevisionLake(root / "lake")
        ingest = lake.ingest(sample_observations(), checkpoint="synthetic-complete")
        snapshot = lake.snapshot(as_of=EXAMPLE_AS_OF, output=root / "snapshot")
        report = validate_point_in_time(
            snapshot.observations,
            as_of=snapshot.manifest.as_of,
            backfill_acknowledged=True,
        )
        assert report.valid
        assert all(item.available_at <= snapshot.manifest.as_of for item in snapshot.observations)
        return {
            "datasetId": snapshot.manifest.dataset_id,
            "ingested": ingest.added,
            "snapshotRows": len(snapshot.observations),
            "valid": report.valid,
            "hindsight": snapshot.manifest.hindsight,
        }
    finally:
        if temporary is not None:
            temporary.cleanup()


def event_study_example() -> dict[str, object]:
    sessions = tuple(
        MarketSession(
            str(item["label"]),
            parse_utc(str(item["opensAt"])),
            parse_utc(str(item["closesAt"])),
        )
        for item in sample_sessions()
    )
    result = build_event_panel(
        sample_observations(),
        sessions,
        sample_outcomes(),
        entity_assets={
            "entity-energy": "SYN-E",
            "entity-policy": "SYN-P",
            "entity-logistics": "SYN-L",
        },
        latency=timedelta(minutes=30),
        overlap="first",
    )
    assert result.rows
    return {**result.summary, "exclusions": len(result.exclusions)}


def exposure_example() -> dict[str, object]:
    rows = exposure_features(sample_observations(), sample_mappings(), as_of=EXAMPLE_AS_OF)
    summary = aggregate_exposure(rows)
    assert rows and summary
    return {
        "exposureRows": len(rows),
        "assets": len(summary),
        "uncertainRows": sum(bool(item["uncertain"]) for item in rows),
        "contradictoryRows": sum(bool(item["contradictory"]) for item in rows),
    }


def weekly_consequence_example() -> dict[str, object]:
    observations = sample_observations()
    features = event_features(observations, as_of=EXAMPLE_AS_OF)
    latest = {
        item.intelligence_id: item
        for item in sorted(observations, key=lambda row: (row.available_at, row.revision))
        if item.available_at <= EXAMPLE_AS_OF
    }
    ranked = sorted(
        latest.values(),
        key=lambda item: (
            item.consequence_rank if item.consequence_rank is not None else -1,
            item.intelligence_id,
        ),
        reverse=True,
    )
    return {
        "edition": "Synthetic weekly consequential developments",
        "attribution": "TNL Bot",
        "developmentCount": len(ranked),
        "featureRows": len(features),
        "evidence": sorted({source for item in ranked for source in item.provenance}),
        "disclaimer": "Synthetic research example; not live news or financial advice.",
    }

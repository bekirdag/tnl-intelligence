from __future__ import annotations

import json
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

import httpx
import pytest

from tnl_intelligence import TnlClient
from tnl_intelligence.quant.errors import RevisionCollisionError
from tnl_intelligence.quant.lake import RevisionLake, load_snapshot
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.temporal import parse_utc


def test_ingest_is_idempotent_and_revision_files_are_immutable(tmp_path: Path) -> None:
    lake = RevisionLake(tmp_path / "lake")
    row = sample_observations()[0]
    first = lake.ingest([row], checkpoint="cursor-1")
    second = lake.ingest([row], checkpoint="cursor-1")
    assert first.added == 1
    assert second.duplicates == 1
    assert lake.checkpoint() == "cursor-1"
    with pytest.raises(RevisionCollisionError):
        lake.ingest([replace(row, title="Different immutable content")])


def test_snapshot_uses_only_revisions_available_as_of(tmp_path: Path) -> None:
    lake = RevisionLake(tmp_path / "lake")
    rows = sample_observations()
    lake.ingest(rows)
    early = lake.snapshot(as_of=parse_utc("2026-06-01T10:00:00Z"), output=tmp_path / "early")
    assert {item.revision_id for item in early.observations} == {"energy-r1", "late-r1"}
    before_retraction = lake.snapshot(
        as_of=parse_utc("2026-06-05T00:00:00Z"), output=tmp_path / "before"
    )
    assert "retracted-r1" in {item.revision_id for item in before_retraction.observations}
    assert "retracted-r2" not in {item.revision_id for item in before_retraction.observations}
    after_retraction = lake.snapshot(
        as_of=parse_utc("2026-06-07T00:00:00Z"), output=tmp_path / "after"
    )
    states = {item.intelligence_id: item.state for item in after_retraction.observations}
    assert states["intel-retracted"] == "retracted"
    assert all(
        item.available_at <= after_retraction.manifest.as_of
        for item in after_retraction.observations
    )


def test_hindsight_is_explicit_and_labeled(tmp_path: Path) -> None:
    lake = RevisionLake(tmp_path / "lake")
    lake.ingest(sample_observations())
    result = lake.snapshot(
        as_of=parse_utc("2026-06-01T10:00:00Z"),
        output=tmp_path / "hindsight",
        hindsight=True,
    )
    assert result.manifest.hindsight
    assert "energy-r2" in {item.revision_id for item in result.observations}


def test_duplicate_and_reordered_ingest_produces_identical_manifest(tmp_path: Path) -> None:
    rows = sample_observations()
    boundary = parse_utc("2026-06-08T00:00:00Z")
    lake_a = RevisionLake(tmp_path / "a")
    lake_b = RevisionLake(tmp_path / "b")
    lake_a.ingest([*rows, rows[0]])
    lake_b.ingest(reversed(rows))
    snapshot_a = lake_a.snapshot(as_of=boundary, output=tmp_path / "snap-a")
    snapshot_b = lake_b.snapshot(as_of=boundary, output=tmp_path / "snap-b")
    assert snapshot_a.manifest.to_dict() == snapshot_b.manifest.to_dict()
    assert (snapshot_a.path / "observations.jsonl").read_bytes() == (
        snapshot_b.path / "observations.jsonl"
    ).read_bytes()


def test_incremental_resume_equals_full_sync(tmp_path: Path) -> None:
    rows = sample_observations()
    incremental = RevisionLake(tmp_path / "incremental")
    incremental.ingest(rows[:3], checkpoint="page-1")
    incremental.ingest(rows[2:], checkpoint="page-2")
    full = RevisionLake(tmp_path / "full")
    full.ingest(rows, checkpoint="page-2")
    boundary = parse_utc("2026-06-08T00:00:00Z")
    left = incremental.snapshot(as_of=boundary, output=tmp_path / "left")
    right = full.snapshot(as_of=boundary, output=tmp_path / "right")
    assert left.manifest.to_dict() == right.manifest.to_dict()


def test_snapshot_load_and_hash_are_stable(tmp_path: Path) -> None:
    lake = RevisionLake(tmp_path / "lake")
    lake.ingest(sample_observations())
    result = lake.snapshot(as_of=parse_utc("2026-06-08T00:00:00Z"), output=tmp_path / "snapshot")
    restored = load_snapshot(result.path)
    assert restored.manifest == result.manifest
    assert restored.observations == result.observations
    manifest_text = (result.path / "manifest.json").read_text(encoding="utf-8")
    assert "/Users/" not in manifest_text
    assert "api_key" not in manifest_text.lower()
    assert json.loads(manifest_text)["datasetId"] == result.manifest.dataset_id


def test_changes_and_filters_use_temporal_boundaries(tmp_path: Path) -> None:
    lake = RevisionLake(tmp_path / "lake")
    lake.ingest(sample_observations())
    changed = lake.changes(
        since=parse_utc("2026-06-01T09:00:00Z"), until=parse_utc("2026-06-01T13:00:00Z")
    )
    assert [item.revision_id for item in changed] == ["energy-r2"]
    result = lake.snapshot(
        as_of=parse_utc("2026-06-08T00:00:00Z"),
        output=tmp_path / "filtered",
        filters={"assets": "SYN-E"},
    )
    assert [item.intelligence_id for item in result.observations] == ["intel-energy"]
    assert result.manifest.as_of - result.observations[0].available_at > timedelta(days=1)


def test_live_sync_persists_page_cursor_and_resumes(tmp_path: Path) -> None:
    rows = sample_observations()[:2]
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        cursor = request.url.params.get("cursor")
        seen.append(cursor)
        index = 1 if cursor == "cursor-2" else 0
        return httpx.Response(
            200,
            json={
                "data": [rows[index].to_dict()],
                "page": {"next_cursor": "cursor-2" if index == 0 else None},
            },
        )

    lake = RevisionLake(tmp_path / "lake")
    with TnlClient(
        "test-key", base_url="https://example.test", transport=httpx.MockTransport(handler)
    ) as client:
        first = lake.sync(client)
        second = lake.sync(client)
    assert first.added == 2
    assert first.checkpoint == "cursor-2"
    assert second.duplicates == 1
    assert seen == [None, "cursor-2", "cursor-2"]

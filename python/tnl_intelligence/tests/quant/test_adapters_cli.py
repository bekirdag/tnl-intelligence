from __future__ import annotations

import importlib
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from tnl_intelligence.quant import adapters
from tnl_intelligence.quant.cli import EXIT_VALIDATION, main
from tnl_intelligence.quant.errors import MissingOptionalDependency
from tnl_intelligence.quant.sample import sample_observations


def test_optional_adapter_reports_precise_extra(monkeypatch: pytest.MonkeyPatch) -> None:
    original = importlib.import_module

    def missing(name: str, package: str | None = None) -> Any:
        if name == "pyarrow":
            raise ImportError(name)
        return original(name, package)

    monkeypatch.setattr(importlib, "import_module", missing)
    with pytest.raises(MissingOptionalDependency, match="quant-arrow"):
        adapters.to_arrow(sample_observations())


def test_cli_sync_snapshot_validate_and_manifest(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "source.jsonl"
    source.write_text(
        "".join(json.dumps(item.to_dict()) + "\n" for item in sample_observations()),
        encoding="utf-8",
    )
    lake = tmp_path / "lake"
    snapshot = tmp_path / "snapshot"
    assert main(["sync", "--input", str(source), "--output", str(lake)]) == 0
    assert (
        main(
            [
                "snapshot",
                "--lake",
                str(lake),
                "--as-of",
                "2026-06-08T00:00:00Z",
                "--output",
                str(snapshot),
            ]
        )
        == 0
    )
    assert main(["validate", str(snapshot), "--acknowledge-backfill"]) == 0
    assert main(["manifest", str(snapshot)]) == 0
    outputs = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert all(value.get("ok", value.get("valid")) for value in outputs)


def test_cli_dry_run_and_validation_exit_codes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["sync", "--output", str(tmp_path), "--dry-run"]) == 0
    assert main(["snapshot", "--lake", str(tmp_path), "--as-of", "naive", "--output", "x"]) == (
        EXIT_VALIDATION
    )
    values = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert values[0]["dryRun"]
    assert values[1]["exitCode"] == EXIT_VALIDATION


def test_cli_event_panel_and_versioned_schemas(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    from tnl_intelligence.quant.lake import RevisionLake
    from tnl_intelligence.quant.sample import sample_outcomes, sample_sessions
    from tnl_intelligence.quant.temporal import parse_utc

    lake = RevisionLake(tmp_path / "lake")
    lake.ingest(sample_observations())
    snapshot = lake.snapshot(as_of=parse_utc("2026-06-08T00:00:00Z"), output=tmp_path / "snapshot")
    sessions = tmp_path / "sessions.json"
    outcomes = tmp_path / "outcomes.json"
    sessions.write_text(json.dumps(sample_sessions()), encoding="utf-8")
    outcomes.write_text(json.dumps(sample_outcomes()), encoding="utf-8")
    config = {
        "schemaVersion": "1.0",
        "snapshot": str(snapshot.path),
        "sessions": str(sessions),
        "outcomes": str(outcomes),
        "entityAssets": {
            "entity-energy": "SYN-E",
            "entity-policy": "SYN-P",
            "entity-logistics": "SYN-L",
        },
        "overlap": "first",
    }
    config_path = tmp_path / "event-study.json"
    config_path.write_text(json.dumps(config), encoding="utf-8")
    output = tmp_path / "panel.jsonl"
    assert main(["event-panel", "--config", str(config_path), "--output", str(output)]) == 0
    assert output.read_text(encoding="utf-8").strip()
    capsys.readouterr()

    repo = Path(__file__).resolve().parents[4]
    config_schema = json.loads(
        (repo / "schemas/quant/event-study-config.schema.json").read_text(encoding="utf-8")
    )
    manifest_schema = json.loads(
        (repo / "schemas/quant/dataset-manifest.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator(config_schema).validate(config)
    Draft202012Validator(manifest_schema, format_checker=FormatChecker()).validate(
        snapshot.manifest.to_dict()
    )

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from collections.abc import Mapping, Sequence
from datetime import timedelta
from pathlib import Path
from typing import Any

from ..client import TnlClient
from ..errors import TnlAuthenticationError, TnlError
from .errors import QuantError
from .event_study import MarketSession, build_event_panel
from .lake import RevisionLake, load_snapshot
from .models import canonical_json
from .temporal import LatencyPolicy, parse_utc
from .validation import validate_point_in_time, validate_snapshot_files

EXIT_VALIDATION = 3
EXIT_AUTHORIZATION = 4
EXIT_UPSTREAM = 5
EXIT_STORAGE = 6


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tnl-quant",
        description="Point-in-time TNL research datasets; no trading or execution.",
    )
    parser.add_argument("--version", action="version", version="tnl-quant 0.1.0")
    commands = parser.add_subparsers(dest="command", required=True)

    sync = commands.add_parser("sync", help="Ingest immutable TNL revisions")
    sync.add_argument("--output", required=True)
    sync.add_argument("--input", help="JSON/JSONL fixture; omit for the TNL API")
    sync.add_argument("--since")
    sync.add_argument("--base-url", default="https://theneuralledger.com")
    sync.add_argument("--checkpoint")
    sync.add_argument("--publication-latency", type=int, default=0)
    sync.add_argument("--revision-latency", type=int, default=0)
    sync.add_argument(
        "--retrieval-policy", choices=("historical", "observed"), default="historical"
    )
    sync.add_argument("--dry-run", action="store_true")

    snapshot = commands.add_parser("snapshot", help="Materialize a point-in-time snapshot")
    snapshot.add_argument("--lake", required=True)
    snapshot.add_argument("--as-of", required=True)
    snapshot.add_argument("--output", required=True)
    snapshot.add_argument("--filter", action="append", default=[], metavar="NAME=VALUE")
    snapshot.add_argument("--hindsight", action="store_true")
    snapshot.add_argument("--dry-run", action="store_true")

    validate = commands.add_parser("validate", help="Validate a materialized snapshot")
    validate.add_argument("path")
    validate.add_argument("--fail-on", choices=("info", "warning", "error"), default="error")
    validate.add_argument("--acknowledge-backfill", action="store_true")

    panel = commands.add_parser("event-panel", help="Build a panel from user-supplied outcomes")
    panel.add_argument("--config", required=True)
    panel.add_argument("--output", required=True)
    panel.add_argument("--dry-run", action="store_true")

    manifest = commands.add_parser("manifest", help="Print and verify a snapshot manifest")
    manifest.add_argument("path")

    purge = commands.add_parser("purge", help="Delete local snapshots or all local lake data")
    purge.add_argument("--lake", required=True)
    group = purge.add_mutually_exclusive_group(required=True)
    group.add_argument("--snapshots", action="store_true")
    group.add_argument("--all", action="store_true")
    purge.add_argument("--yes", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "sync":
            return _sync(args)
        if args.command == "snapshot":
            return _snapshot(args)
        if args.command == "validate":
            return _validate(args)
        if args.command == "event-panel":
            return _event_panel(args)
        if args.command == "manifest":
            return _manifest(args)
        if args.command == "purge":
            return _purge(args)
    except TnlAuthenticationError as error:
        _print({"ok": False, "error": str(error), "exitCode": EXIT_AUTHORIZATION})
        return EXIT_AUTHORIZATION
    except TnlError as error:
        _print({"ok": False, "error": str(error), "exitCode": EXIT_UPSTREAM})
        return EXIT_UPSTREAM
    except (OSError, json.JSONDecodeError) as error:
        _print({"ok": False, "error": str(error), "exitCode": EXIT_STORAGE})
        return EXIT_STORAGE
    except (QuantError, ValueError, TypeError) as error:
        _print({"ok": False, "error": str(error), "exitCode": EXIT_VALIDATION})
        return EXIT_VALIDATION
    parser.error("unknown command")
    return 2


def _sync(args: argparse.Namespace) -> int:
    policy = LatencyPolicy(
        args.publication_latency,
        args.revision_latency,
        args.retrieval_policy,
    )
    if args.dry_run:
        _print(
            {
                "ok": True,
                "dryRun": True,
                "source": args.input or "TNL API",
                "output": str(Path(args.output).expanduser()),
                "latencyPolicy": policy.to_dict(),
            }
        )
        return 0
    lake = RevisionLake(args.output)
    if args.input:
        values = _read_records(args.input)
        result = lake.ingest(values, checkpoint=args.checkpoint, policy=policy)
    else:
        api_key = os.environ.get("TNL_API_KEY", "")
        if not api_key:
            raise TnlAuthenticationError("TNL_API_KEY is required for live sync")
        with TnlClient(api_key, base_url=args.base_url) as client:
            query = {"published_since": args.since} if args.since else {}
            result = lake.sync(client, checkpoint=args.checkpoint, policy=policy, **query)
    _print({"ok": True, **result.to_dict(), "lake": str(lake.root)})
    return 0


def _snapshot(args: argparse.Namespace) -> int:
    filters = _filters(args.filter)
    if args.dry_run:
        _print(
            {
                "ok": True,
                "dryRun": True,
                "asOf": args.as_of,
                "filters": filters,
                "hindsight": args.hindsight,
            }
        )
        return 0
    result = RevisionLake(args.lake).snapshot(
        as_of=parse_utc(args.as_of, field="as_of"),
        output=args.output,
        filters=filters,
        hindsight=args.hindsight,
    )
    _print(
        {
            "ok": True,
            "datasetId": result.manifest.dataset_id,
            "rows": len(result.observations),
            "output": str(result.path),
            "hindsight": result.manifest.hindsight,
        }
    )
    return 0


def _validate(args: argparse.Namespace) -> int:
    snapshot = load_snapshot(args.path)
    file_report = validate_snapshot_files(args.path)
    temporal_report = validate_point_in_time(
        snapshot.observations,
        as_of=snapshot.manifest.as_of,
        backfill_acknowledged=args.acknowledge_backfill,
    )
    findings = (*file_report.findings, *temporal_report.findings)
    combined = type(temporal_report)(findings, temporal_report.checked_rows)
    _print(combined.to_dict())
    return EXIT_VALIDATION if combined.fails(args.fail_on) else 0


def _event_panel(args: argparse.Namespace) -> int:
    config = _read_config(args.config)
    if config.get("schemaVersion") != "1.0":
        raise ValueError("event-panel config schemaVersion must be 1.0")
    required = ("snapshot", "sessions", "outcomes")
    missing = [name for name in required if not config.get(name)]
    if missing:
        raise ValueError(f"event-panel config missing: {', '.join(missing)}")
    if args.dry_run:
        _print({"ok": True, "dryRun": True, "config": str(Path(args.config))})
        return 0
    snapshot = load_snapshot(str(config["snapshot"]))
    sessions = tuple(
        MarketSession(
            str(item["label"]),
            parse_utc(str(item["opensAt"]), field="opensAt"),
            parse_utc(str(item["closesAt"]), field="closesAt"),
        )
        for item in _read_records(str(config["sessions"]))
    )
    outcomes = _read_records(str(config["outcomes"]))
    entity_assets = {
        str(name): str(value) for name, value in dict(config.get("entityAssets") or {}).items()
    }
    result = build_event_panel(
        snapshot.observations,
        sessions,
        outcomes,
        entity_assets=entity_assets,
        latency=timedelta(seconds=int(config.get("latencySeconds", 0))),
        pre=int(config.get("pre", 1)),
        post=int(config.get("post", 1)),
        overlap=str(config.get("overlap", "exclude")),  # type: ignore[arg-type]
    )
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.partial")
    temporary.write_text(
        "".join(f"{canonical_json(row)}\n" for row in result.rows), encoding="utf-8"
    )
    temporary.replace(output)
    summary = dict(result.summary)
    summary["ok"] = True
    summary["output"] = str(output)
    summary["exclusions"] = list(result.exclusions)
    _print(summary)
    return 0


def _manifest(args: argparse.Namespace) -> int:
    root = Path(args.path).expanduser().resolve()
    report = validate_snapshot_files(root)
    value = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    _print({"ok": report.valid, "manifest": value, "validation": report.to_dict()})
    return 0 if report.valid else EXIT_VALIDATION


def _purge(args: argparse.Namespace) -> int:
    if not args.yes:
        raise ValueError("purge requires --yes")
    removed = RevisionLake(args.lake).purge(snapshots=args.snapshots, all_data=args.all)
    _print({"ok": True, "removed": [str(path) for path in removed]})
    return 0


def _read_records(path: str) -> list[dict[str, Any]]:
    source = Path(path).expanduser().resolve()
    text = source.read_text(encoding="utf-8")
    if source.suffix == ".jsonl":
        values = [json.loads(line) for line in text.splitlines() if line.strip()]
    else:
        decoded = json.loads(text)
        values = decoded if isinstance(decoded, list) else decoded.get("data", [])
    if not isinstance(values, list) or not all(isinstance(item, Mapping) for item in values):
        raise ValueError(f"{source} must contain an array or JSONL objects")
    return [dict(item) for item in values]


def _read_config(path: str) -> dict[str, Any]:
    source = Path(path).expanduser().resolve()
    if source.suffix.lower() in {".yaml", ".yml"}:
        try:
            yaml = importlib.import_module("yaml")
        except ImportError as error:
            from .errors import MissingOptionalDependency

            raise MissingOptionalDependency("PyYAML", "quant-cli") from error
        value = yaml.safe_load(source.read_text(encoding="utf-8"))
    else:
        value = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(value, Mapping):
        raise ValueError("config must be an object")
    return dict(value)


def _filters(values: Sequence[str]) -> dict[str, object]:
    result: dict[str, object] = {}
    for value in values:
        name, separator, content = value.partition("=")
        if not separator or not name or not content:
            raise ValueError("filters must use NAME=VALUE")
        existing = result.get(name)
        if existing is None:
            result[name] = content
        elif isinstance(existing, list):
            existing.append(content)
        else:
            result[name] = [existing, content]
    return result


def _print(value: object) -> None:
    sys.stdout.write(f"{canonical_json(value)}\n")


if __name__ == "__main__":
    raise SystemExit(main())

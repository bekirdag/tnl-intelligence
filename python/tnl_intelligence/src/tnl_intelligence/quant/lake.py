from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from collections.abc import Callable, Iterable, Iterator, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..client import TnlClient
from ..models import Story
from .errors import RevisionCollisionError
from .models import (
    DatasetManifest,
    IntelligenceObservation,
    ManifestFile,
    canonical_json,
    content_hash,
    observation_columns,
    observation_schema,
)
from .temporal import LatencyPolicy, format_utc, parse_utc

ProgressCallback = Callable[[int, IntelligenceObservation], None]
CancelCallback = Callable[[], bool]


@dataclass(frozen=True, slots=True)
class IngestResult:
    received: int
    added: int
    duplicates: int
    checkpoint: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "received": self.received,
            "added": self.added,
            "duplicates": self.duplicates,
            "checkpoint": self.checkpoint,
        }


@dataclass(frozen=True, slots=True)
class SnapshotResult:
    path: Path
    observations: tuple[IntelligenceObservation, ...]
    manifest: DatasetManifest


class RevisionLake:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).expanduser().resolve()
        self.revisions_path = self.root / "revisions"
        self.snapshots_path = self.root / "snapshots"
        self.checkpoint_path = self.root / "checkpoint.json"

    def initialize(self) -> None:
        self.revisions_path.mkdir(parents=True, exist_ok=True)
        self.snapshots_path.mkdir(parents=True, exist_ok=True)

    def ingest(
        self,
        values: Iterable[IntelligenceObservation | Story | Mapping[str, Any]],
        *,
        checkpoint: str | None = None,
        retrieved_at: datetime | None = None,
        policy: LatencyPolicy | None = None,
        progress: ProgressCallback | None = None,
        cancelled: CancelCallback | None = None,
    ) -> IngestResult:
        self.initialize()
        received = added = duplicates = 0
        for value in values:
            if cancelled and cancelled():
                break
            received += 1
            observation = normalize_observation(value, retrieved_at=retrieved_at, policy=policy)
            destination = self._revision_path(observation)
            encoded = f"{canonical_json(observation.to_dict())}\n".encode()
            if destination.exists():
                existing = json.loads(destination.read_text(encoding="utf-8"))
                incoming = observation.to_dict()
                if _revision_content(existing) != _revision_content(incoming):
                    raise RevisionCollisionError(
                        f"revision {observation.key} already exists with different content"
                    )
                duplicates += 1
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                _atomic_write(destination, encoded)
                added += 1
            if progress:
                progress(received, observation)
        self._write_current_view()
        if checkpoint is not None:
            self._write_checkpoint(checkpoint)
        return IngestResult(received, added, duplicates, checkpoint)

    def sync(
        self,
        client: TnlClient,
        *,
        checkpoint: str | None = None,
        policy: LatencyPolicy | None = None,
        progress: ProgressCallback | None = None,
        cancelled: CancelCallback | None = None,
        **query: Any,
    ) -> IngestResult:
        cursor = checkpoint or self.checkpoint()
        seen: set[str] = set()
        received = added = duplicates = 0
        final_checkpoint = cursor
        while True:
            if cancelled and cancelled():
                break
            page = client.list_news(**query, **({"cursor": cursor} if cursor else {}))
            result = self.ingest(
                page.data,
                retrieved_at=datetime.now(timezone.utc),
                policy=policy,
                progress=progress,
                cancelled=cancelled,
            )
            received += result.received
            added += result.added
            duplicates += result.duplicates
            next_cursor = page.page.next_cursor
            if not next_cursor or next_cursor in seen:
                break
            seen.add(next_cursor)
            final_checkpoint = next_cursor
            self._write_checkpoint(next_cursor)
            cursor = next_cursor
        return IngestResult(received, added, duplicates, final_checkpoint)

    def observations(self) -> Iterator[IntelligenceObservation]:
        if not self.revisions_path.exists():
            return
        for path in sorted(self.revisions_path.glob("*/*.json")):
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, Mapping):
                yield IntelligenceObservation.from_dict(value)

    def history(self, intelligence_id: str) -> tuple[IntelligenceObservation, ...]:
        return tuple(
            sorted(
                (item for item in self.observations() if item.intelligence_id == intelligence_id),
                key=_revision_order,
            )
        )

    def changes(self, *, since: datetime, until: datetime) -> tuple[IntelligenceObservation, ...]:
        lower = parse_utc(since, field="since")
        upper = parse_utc(until, field="until")
        if upper < lower:
            raise ValueError("until must be at or after since")
        return tuple(item for item in self.observations() if lower <= item.available_at <= upper)

    def select(
        self,
        *,
        as_of: datetime,
        filters: Mapping[str, object] | None = None,
        hindsight: bool = False,
    ) -> tuple[IntelligenceObservation, ...]:
        boundary = parse_utc(as_of, field="as_of")
        selected: dict[str, IntelligenceObservation] = {}
        for item in self.observations():
            if not hindsight and item.available_at > boundary:
                continue
            if not _matches(item, filters or {}):
                continue
            previous = selected.get(item.intelligence_id)
            if previous is None or _revision_order(item) > _revision_order(previous):
                selected[item.intelligence_id] = item
        return tuple(sorted(selected.values(), key=lambda item: (item.available_at, item.key)))

    def snapshot(
        self,
        *,
        as_of: datetime,
        output: str | Path | None = None,
        filters: Mapping[str, object] | None = None,
        policy: LatencyPolicy | None = None,
        hindsight: bool = False,
        feature_versions: Mapping[str, str] | None = None,
        entity_map_version: str = "none",
        access_tier: str = "developer",
    ) -> SnapshotResult:
        self.initialize()
        boundary = parse_utc(as_of, field="as_of")
        query = dict(sorted((filters or {}).items()))
        rows = self.select(as_of=boundary, filters=query, hindsight=hindsight)
        encoded = "".join(f"{canonical_json(item.to_dict())}\n" for item in rows).encode()
        logical = {
            "asOf": format_utc(boundary),
            "query": query,
            "rows": [content_hash(item.to_dict()) for item in rows],
            "policy": (policy or LatencyPolicy()).to_dict(),
            "features": dict(sorted((feature_versions or {}).items())),
            "entityMapVersion": entity_map_version,
            "hindsight": hindsight,
        }
        dataset_id = f"tnl-{content_hash(logical)[:20]}"
        destination = (
            Path(output).expanduser().resolve()
            if output is not None
            else self.snapshots_path / dataset_id
        )
        checkpoint = self.checkpoint()
        file = ManifestFile(
            path="observations.jsonl",
            row_count=len(rows),
            sha256=hashlib.sha256(encoded).hexdigest(),
            columns=observation_columns(),
            column_types=observation_schema(),
        )
        manifest = DatasetManifest(
            dataset_id=dataset_id,
            created_at=boundary,
            as_of=boundary,
            query=query,
            api_version="v1",
            schema_version="1.0.0",
            source_cursor=checkpoint,
            revision_watermark=rows[-1].revision_id if rows else None,
            files=(file,),
            latency_policy=policy or LatencyPolicy(),
            entity_map_version=entity_map_version,
            feature_versions=dict(sorted((feature_versions or {}).items())),
            access_tier=access_tier,
            license="TNL API terms and applicable source licenses",
            redistribution="Metadata and permitted fields only; no third-party article bodies.",
            hindsight=hindsight,
        )
        _write_snapshot(destination, encoded, manifest)
        return SnapshotResult(destination, rows, manifest)

    def checkpoint(self) -> str | None:
        if not self.checkpoint_path.exists():
            return None
        value = json.loads(self.checkpoint_path.read_text(encoding="utf-8"))
        return (
            str(value.get("cursor")) if isinstance(value, Mapping) and value.get("cursor") else None
        )

    def purge(self, *, snapshots: bool = False, all_data: bool = False) -> tuple[Path, ...]:
        removed: list[Path] = []
        candidates = [self.snapshots_path] if snapshots else []
        if all_data:
            candidates = [self.revisions_path, self.snapshots_path, self.checkpoint_path]
        for path in candidates:
            if path.is_dir():
                shutil.rmtree(path)
                removed.append(path)
            elif path.exists():
                path.unlink()
                removed.append(path)
        return tuple(removed)

    def _revision_path(self, observation: IntelligenceObservation) -> Path:
        intelligence = hashlib.sha256(observation.intelligence_id.encode()).hexdigest()[:24]
        revision = hashlib.sha256(observation.revision_id.encode()).hexdigest()[:24]
        return self.revisions_path / intelligence / f"{revision}.json"

    def _write_checkpoint(self, cursor: str) -> None:
        payload = canonical_json({"cursor": cursor, "schemaVersion": "1.0.0"}).encode() + b"\n"
        _atomic_write(self.checkpoint_path, payload)

    def _write_current_view(self) -> None:
        current: dict[str, IntelligenceObservation] = {}
        for item in self.observations():
            previous = current.get(item.intelligence_id)
            if previous is None or _revision_order(item) > _revision_order(previous):
                current[item.intelligence_id] = item
        payload = "".join(
            f"{canonical_json(item.to_dict())}\n"
            for item in sorted(current.values(), key=lambda row: row.intelligence_id)
        ).encode()
        _atomic_write(self.root / "current.jsonl", payload)


def normalize_observation(
    value: IntelligenceObservation | Story | Mapping[str, Any],
    *,
    retrieved_at: datetime | None = None,
    policy: LatencyPolicy | None = None,
) -> IntelligenceObservation:
    if isinstance(value, IntelligenceObservation):
        return value
    if isinstance(value, Story):
        return IntelligenceObservation.from_story(value, retrieved_at=retrieved_at, policy=policy)
    payload = dict(value)
    if retrieved_at is not None and "retrievedAt" not in payload and "retrieved_at" not in payload:
        payload["retrievedAt"] = format_utc(retrieved_at)
    observation = IntelligenceObservation.from_dict(payload)
    if policy is None:
        return observation
    payload = observation.to_dict()
    payload["availableAt"] = format_utc(
        policy.availability(
            published_at=observation.tnl_published_at,
            revised_at=observation.tnl_revised_at,
            retrieved_at=observation.retrieved_at,
        )
    )
    return IntelligenceObservation.from_dict(payload)


def load_snapshot(path: str | Path) -> SnapshotResult:
    root = Path(path).expanduser().resolve()
    manifest_value = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    rows = tuple(
        IntelligenceObservation.from_dict(json.loads(line))
        for line in (root / "observations.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    )
    manifest = _manifest_from_dict(manifest_value)
    return SnapshotResult(root, rows, manifest)


def _manifest_from_dict(value: Mapping[str, Any]) -> DatasetManifest:
    policy_value = value.get("latencyPolicy")
    policy = policy_value if isinstance(policy_value, Mapping) else {}
    files_value = value.get("files")
    files = files_value if isinstance(files_value, list) else []
    return DatasetManifest(
        dataset_id=str(value["datasetId"]),
        created_at=parse_utc(str(value["createdAt"])),
        as_of=parse_utc(str(value["asOf"])),
        query=dict(value.get("query") or {}),
        api_version=str(value.get("apiVersion", "v1")),
        schema_version=str(value.get("schemaVersion", "1.0.0")),
        source_cursor=str(value["sourceCursor"]) if value.get("sourceCursor") else None,
        revision_watermark=(
            str(value["revisionWatermark"]) if value.get("revisionWatermark") else None
        ),
        files=tuple(
            ManifestFile(
                path=str(item["path"]),
                row_count=int(item["rowCount"]),
                sha256=str(item["sha256"]),
                columns=tuple(str(column) for column in item.get("columns", [])),
                media_type=str(item.get("mediaType", "application/x-ndjson")),
                column_types={
                    str(name): str(kind)
                    for name, kind in dict(item.get("columnTypes") or {}).items()
                },
            )
            for item in files
            if isinstance(item, Mapping)
        ),
        latency_policy=LatencyPolicy(
            publication_latency_seconds=int(policy.get("publicationLatencySeconds", 0)),
            revision_latency_seconds=int(policy.get("revisionLatencySeconds", 0)),
            retrieval_policy=str(policy.get("retrievalPolicy", "historical")),  # type: ignore[arg-type]
        ),
        entity_map_version=str(value.get("entityMapVersion", "none")),
        feature_versions=dict(value.get("featureVersions") or {}),
        access_tier=str(value.get("accessTier", "developer")),
        license=str(value.get("license", "")),
        redistribution=str(value.get("redistribution", "")),
        hindsight=bool(value.get("hindsight", False)),
    )


def _write_snapshot(path: Path, observations: bytes, manifest: DatasetManifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{path.name}.", dir=path.parent))
    try:
        (temporary / "observations.jsonl").write_bytes(observations)
        (temporary / "manifest.json").write_text(
            f"{canonical_json(manifest.to_dict())}\n", encoding="utf-8"
        )
        if path.exists():
            existing = path / "manifest.json"
            if (
                existing.exists()
                and existing.read_bytes() == (temporary / "manifest.json").read_bytes()
            ):
                shutil.rmtree(temporary)
                return
            backup = path.with_name(f".{path.name}.previous")
            if backup.exists():
                shutil.rmtree(backup)
            os.replace(path, backup)
            os.replace(temporary, path)
            shutil.rmtree(backup)
        else:
            os.replace(temporary, path)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def _revision_order(item: IntelligenceObservation) -> tuple[datetime, int, str]:
    return item.available_at, item.revision, item.revision_id


def _revision_content(value: object) -> object:
    if not isinstance(value, Mapping):
        return value
    return {
        name: item for name, item in value.items() if name not in {"retrievedAt", "availableAt"}
    }


def _matches(item: IntelligenceObservation, filters: Mapping[str, object]) -> bool:
    for name, expected in filters.items():
        actual = getattr(item, _snake(name), None)
        if isinstance(actual, tuple):
            values = expected if isinstance(expected, list | tuple | set) else [expected]
            if not any(value in actual for value in values):
                return False
        elif isinstance(expected, list | tuple | set):
            if actual not in expected:
                return False
        elif actual != expected:
            return False
    return True


def _snake(value: str) -> str:
    result: list[str] = []
    for character in value:
        if character.isupper():
            result.extend(("_", character.lower()))
        else:
            result.append(character)
    return "".join(result).lstrip("_")

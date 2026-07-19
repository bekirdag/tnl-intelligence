from __future__ import annotations

import importlib.metadata
import platform
import tempfile
import tracemalloc
from dataclasses import replace
from pathlib import Path
from time import perf_counter

from .features import event_features
from .lake import RevisionLake
from .sample import sample_observations
from .temporal import parse_utc


def run_benchmark(*, count: int = 5_000, root: str | Path | None = None) -> dict[str, object]:
    if count < 1:
        raise ValueError("count must be positive")
    temporary: tempfile.TemporaryDirectory[str] | None = None
    if root is None:
        temporary = tempfile.TemporaryDirectory(prefix="tnl-quant-benchmark-")
        output = Path(temporary.name)
    else:
        output = Path(root).expanduser().resolve()
    source = sample_observations()
    rows = tuple(
        replace(
            source[index % len(source)],
            intelligence_id=f"benchmark-{index:08d}",
            revision_id=f"benchmark-r-{index:08d}",
            event_id=f"benchmark-event-{index:08d}",
            canonical_url=f"https://theneuralledger.com/synthetic/benchmark-{index:08d}",
        )
        for index in range(count)
    )
    tracemalloc.start()
    started = perf_counter()
    lake = RevisionLake(output / "lake")
    ingest = lake.ingest(rows)
    ingest_seconds = perf_counter() - started
    started = perf_counter()
    snapshot = lake.snapshot(as_of=parse_utc("2026-07-01T00:00:00Z"), output=output / "snapshot")
    snapshot_seconds = perf_counter() - started
    started = perf_counter()
    features = event_features(snapshot.observations, as_of=snapshot.manifest.as_of)
    feature_seconds = perf_counter() - started
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    result = {
        "referenceHardware": platform.platform(),
        "python": platform.python_version(),
        "rows": count,
        "ingestedRows": ingest.added,
        "snapshotRows": len(snapshot.observations),
        "featureRows": len(features),
        "ingestSeconds": round(ingest_seconds, 6),
        "snapshotSeconds": round(snapshot_seconds, 6),
        "featureSeconds": round(feature_seconds, 6),
        "peakMemoryMiB": round(peak / 1024 / 1024, 3),
        "dependencies": {
            name: _version(name) for name in ("duckdb", "pandas", "polars", "pyarrow")
        },
    }
    if temporary is not None:
        temporary.cleanup()
    return result


def assert_reference_bounds(result: dict[str, object]) -> None:
    rows = int(_number(result, "rows"))
    scale = max(1.0, rows / 5_000)
    if _number(result, "ingestSeconds") > 30 * scale:
        raise AssertionError("ingestion exceeded the reference bound")
    if _number(result, "snapshotSeconds") > 20 * scale:
        raise AssertionError("snapshot selection exceeded the reference bound")
    if _number(result, "featureSeconds") > 10 * scale:
        raise AssertionError("feature construction exceeded the reference bound")
    if _number(result, "peakMemoryMiB") > 512 * scale:
        raise AssertionError("peak memory exceeded the reference bound")


def _version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def _number(result: dict[str, object], name: str) -> float:
    value = result[name]
    if not isinstance(value, int | float):
        raise TypeError(f"{name} must be numeric")
    return float(value)

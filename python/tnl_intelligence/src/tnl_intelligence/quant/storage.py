from __future__ import annotations

import hashlib
import importlib
import re
import shutil
import tempfile
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path

from .adapters import duckdb_connection, records, to_arrow
from .errors import MissingOptionalDependency
from .models import IntelligenceObservation


@dataclass(frozen=True, slots=True)
class ParquetResult:
    path: Path
    row_count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class PartitionedParquetResult:
    path: Path
    row_count: int
    files: tuple[ParquetResult, ...]


def write_parquet(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
    path: str | Path,
    *,
    compression: str = "zstd",
) -> ParquetResult:
    try:
        pq = importlib.import_module("pyarrow.parquet")
    except ImportError as error:
        raise MissingOptionalDependency("pyarrow", "quant-arrow") from error
    rows = records(values)
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.partial")
    table = to_arrow(rows)
    pq.write_table(
        table,
        temporary,
        compression=compression,
        use_dictionary=False,
        write_statistics=True,
        data_page_version="1.0",
    )
    temporary.replace(destination)
    return ParquetResult(
        destination, len(rows), hashlib.sha256(destination.read_bytes()).hexdigest()
    )


def write_partitioned_parquet(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
    path: str | Path,
) -> PartitionedParquetResult:
    rows = records(values)
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{destination.name}.", dir=destination.parent))
    groups: defaultdict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        published = str(row.get("tnlPublishedAt", "unknown"))[:10]
        category = _partition_value(str(row.get("category") or "uncategorized"))
        groups[(published, category)].append(row)
    results: list[ParquetResult] = []
    try:
        for index, ((published, category), group) in enumerate(sorted(groups.items())):
            relative = (
                Path(f"date={published}") / f"category={category}" / f"part-{index:05d}.parquet"
            )
            output = temporary / relative
            written = write_parquet(group, output)
            results.append(ParquetResult(destination / relative, written.row_count, written.sha256))
        if destination.exists():
            shutil.rmtree(destination)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return PartitionedParquetResult(destination, len(rows), tuple(results))


def register_snapshot(path: str | Path, *, view: str = "tnl_observations") -> object:
    return duckdb_connection(path, view=view)


def _partition_value(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "-", value.lower()).strip("-")
    return normalized[:60] or "unknown"

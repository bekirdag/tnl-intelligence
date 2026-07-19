from __future__ import annotations

import importlib
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

from .errors import MissingOptionalDependency
from .models import IntelligenceObservation
from .temporal import parse_utc


def records(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
) -> list[dict[str, object]]:
    return [
        item.to_dict() if isinstance(item, IntelligenceObservation) else dict(item)
        for item in values
    ]


def to_arrow(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
) -> Any:
    try:
        pa = importlib.import_module("pyarrow")
    except ImportError as error:
        raise MissingOptionalDependency("pyarrow", "quant-arrow") from error
    rows = records(values)
    if rows and "tnlPublishedAt" in rows[0]:
        timestamps = {
            "eventTime",
            "sourcePublishedAt",
            "tnlPublishedAt",
            "tnlRevisedAt",
            "retrievedAt",
            "availableAt",
        }
        normalized = [
            {
                name: (
                    parse_utc(value, field=name)
                    if name in timestamps and isinstance(value, str)
                    else value
                )
                for name, value in row.items()
            }
            for row in rows
        ]
        return pa.Table.from_pylist(normalized, schema=_observation_schema(pa))
    return pa.Table.from_pylist(rows)


def to_pandas(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
) -> Any:
    try:
        pd = importlib.import_module("pandas")
    except ImportError as error:
        raise MissingOptionalDependency("pandas", "quant-pandas") from error
    frame = pd.DataFrame.from_records(records(values))
    for name in (
        "eventTime",
        "sourcePublishedAt",
        "tnlPublishedAt",
        "tnlRevisedAt",
        "retrievedAt",
        "availableAt",
        "featureTimestamp",
    ):
        if name in frame.columns:
            frame[name] = pd.to_datetime(frame[name], utc=True)
    return frame


def to_polars(
    values: Iterable[IntelligenceObservation | Mapping[str, object]],
) -> Any:
    try:
        pl = importlib.import_module("polars")
    except ImportError as error:
        raise MissingOptionalDependency("polars", "quant-polars") from error
    frame = pl.DataFrame(records(values))
    timestamp_names = {
        "eventTime",
        "sourcePublishedAt",
        "tnlPublishedAt",
        "tnlRevisedAt",
        "retrievedAt",
        "availableAt",
        "featureTimestamp",
    }
    expressions = [
        pl.col(name).str.to_datetime(time_zone="UTC", strict=False).alias(name)
        for name in frame.columns
        if name in timestamp_names and frame.schema[name] == pl.String
    ]
    return frame.with_columns(expressions) if expressions else frame


def scan_polars(path: str | Path) -> Any:
    try:
        pl = importlib.import_module("polars")
    except ImportError as error:
        raise MissingOptionalDependency("polars", "quant-polars") from error
    return pl.scan_parquet(str(Path(path).expanduser().resolve()))


def duckdb_connection(
    parquet: str | Path | None = None,
    *,
    view: str = "tnl_observations",
) -> Any:
    try:
        duckdb = importlib.import_module("duckdb")
    except ImportError as error:
        raise MissingOptionalDependency("duckdb", "quant-duckdb") from error
    connection = duckdb.connect(":memory:")
    if parquet is not None:
        path = str(Path(parquet).expanduser().resolve())
        connection.from_parquet(path).create_view(_identifier(view))
    return connection


def _identifier(value: str) -> str:
    if not value or not value.replace("_", "").isalnum():
        raise ValueError("view must contain only letters, numbers, and underscores")
    return value


def _observation_schema(pa: Any) -> Any:
    string = pa.string()
    timestamp = pa.timestamp("us", tz="UTC")
    return pa.schema(
        [
            ("intelligenceId", string),
            ("revision", pa.int64()),
            ("revisionId", string),
            ("eventId", string),
            ("eventType", string),
            ("title", string),
            ("summary", string),
            ("category", string),
            ("geography", string),
            ("language", string),
            ("consequenceRank", pa.float64()),
            ("entities", pa.list_(string)),
            ("assets", pa.list_(string)),
            ("impactPaths", pa.list_(string)),
            ("impactDirection", string),
            ("horizon", string),
            ("confidence", pa.float64()),
            ("materiality", pa.float64()),
            ("sourceCount", pa.int64()),
            ("eventTime", timestamp),
            ("sourcePublishedAt", timestamp),
            ("tnlPublishedAt", timestamp),
            ("tnlRevisedAt", timestamp),
            ("retrievedAt", timestamp),
            ("availableAt", timestamp),
            ("state", string),
            ("provenance", pa.list_(string)),
            ("canonicalUrl", string),
            ("inferredFields", pa.list_(string)),
        ]
    )

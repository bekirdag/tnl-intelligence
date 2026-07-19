from __future__ import annotations

from pathlib import Path

import polars as pl

from tnl_intelligence.quant.adapters import (
    duckdb_connection,
    scan_polars,
    to_arrow,
    to_pandas,
    to_polars,
)
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.storage import write_parquet, write_partitioned_parquet


def test_arrow_pandas_and_polars_preserve_identity_and_utc() -> None:
    rows = sample_observations()
    arrow = to_arrow(rows)
    pandas = to_pandas(rows)
    polars = to_polars(rows)
    expected = [item.intelligence_id for item in rows]
    assert arrow.column("intelligenceId").to_pylist() == expected
    assert pandas["intelligenceId"].tolist() == expected
    assert str(pandas["availableAt"].dtype).endswith("UTC]")
    assert polars["intelligenceId"].to_list() == expected
    assert str(polars.schema["availableAt"]).startswith("Datetime")


def test_parquet_duckdb_and_lazy_polars_round_trip(tmp_path: Path) -> None:
    rows = sample_observations()
    parquet = tmp_path / "snapshot.parquet"
    result = write_parquet(rows, parquet)
    assert result.row_count == len(rows)
    connection = duckdb_connection(parquet)
    try:
        assert connection.execute("SELECT count(*) FROM tnl_observations").fetchone()[0] == len(
            rows
        )
        assert (
            connection.execute(
                'SELECT count(*) FROM tnl_observations WHERE "availableAt" <= ?',
                ["2026-06-02T00:00:00.000000Z"],
            ).fetchone()[0]
            == 3
        )
    finally:
        connection.close()
    assert scan_polars(parquet).select("revisionId").collect().height == len(rows)


def test_partitioned_parquet_is_stable_and_pushdown_friendly(tmp_path: Path) -> None:
    rows = sample_observations()
    result = write_partitioned_parquet(rows, tmp_path / "partitioned")
    assert result.row_count == len(rows)
    assert all(item.path.is_file() for item in result.files)
    assert all("date=" in str(item.path) and "category=" in str(item.path) for item in result.files)
    lazy = scan_polars(result.path / "**/*.parquet")
    assert lazy.filter(pl.col("category") == "synthetic").collect().height == len(rows)

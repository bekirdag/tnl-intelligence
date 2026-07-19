from __future__ import annotations

from pathlib import Path

from tnl_intelligence.quant.benchmark import assert_reference_bounds, run_benchmark


def test_reference_benchmark_is_bounded(tmp_path: Path) -> None:
    result = run_benchmark(count=1_000, root=tmp_path)
    assert result["ingestedRows"] == 1_000
    assert result["snapshotRows"] == 1_000
    assert result["featureRows"] == 1_000
    assert_reference_bounds(result)

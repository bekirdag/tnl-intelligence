from __future__ import annotations

from pathlib import Path

from tnl_intelligence.quant.asset_builder import write_assets
from tnl_intelligence.quant.examples import (
    event_study_example,
    exposure_example,
    point_in_time_example,
    weekly_consequence_example,
)
from tnl_intelligence.quant.notebook_runner import execute_notebooks

ASSETS = Path(__file__).parents[2] / "src" / "tnl_intelligence" / "quant" / "example_assets"


def test_generated_sample_and_notebook_assets_are_current() -> None:
    assert write_assets(ASSETS, check=True) == ()


def test_paired_noninteractive_examples() -> None:
    assert point_in_time_example()["valid"]
    assert int(event_study_example()["rowCount"]) > 0
    assert int(exposure_example()["exposureRows"]) > 0
    assert weekly_consequence_example()["attribution"] == "TNL Bot"


def test_all_notebooks_execute_without_hidden_state() -> None:
    executed = execute_notebooks(ASSETS / "notebooks")
    assert executed == (
        "01-point-in-time.ipynb",
        "02-event-study.ipynb",
        "03-entity-exposure.ipynb",
        "04-weekly-consequence.ipynb",
    )

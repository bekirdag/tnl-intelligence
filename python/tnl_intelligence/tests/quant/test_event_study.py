from __future__ import annotations

from datetime import timedelta

from tnl_intelligence.quant.event_study import MarketSession, build_event_panel
from tnl_intelligence.quant.sample import sample_observations, sample_outcomes, sample_sessions
from tnl_intelligence.quant.temporal import parse_utc


def _sessions() -> tuple[MarketSession, ...]:
    return tuple(
        MarketSession(
            str(item["label"]),
            parse_utc(str(item["opensAt"])),
            parse_utc(str(item["closesAt"])),
        )
        for item in sample_sessions()
    )


def test_event_panel_uses_user_outcomes_latency_and_windows() -> None:
    result = build_event_panel(
        sample_observations(),
        _sessions(),
        sample_outcomes(),
        entity_assets={
            "entity-energy": "SYN-E",
            "entity-policy": "SYN-P",
            "entity-logistics": "SYN-L",
        },
        latency=timedelta(minutes=30),
        pre=1,
        post=1,
        overlap="first",
    )
    assert result.rows
    assert all(-1 <= int(row["windowOffset"]) <= 1 for row in result.rows)
    assert result.summary["meanAbnormalOutcome"] is not None
    assert "not financial advice" in str(result.summary["disclaimer"])
    assert any(item["reason"] == "overlap_first" for item in result.exclusions)


def test_event_panel_excludes_overlapping_events_by_default() -> None:
    result = build_event_panel(
        sample_observations()[:2],
        _sessions(),
        sample_outcomes(),
        entity_assets={"entity-energy": "SYN-E"},
    )
    assert not result.rows
    assert {item["reason"] for item in result.exclusions} == {"overlap"}

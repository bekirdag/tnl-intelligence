from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from tnl_intelligence.quant.errors import TemporalIntegrityError
from tnl_intelligence.quant.models import (
    EntityAssetMapping,
    IntelligenceObservation,
    canonical_json,
)
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.temporal import LatencyPolicy, format_utc, parse_utc


def test_parse_utc_rejects_naive_and_normalizes_offset() -> None:
    with pytest.raises(TemporalIntegrityError, match="timezone"):
        parse_utc("2026-01-01T00:00:00")
    assert format_utc(parse_utc("2026-01-01T03:00:00+03:00")) == ("2026-01-01T00:00:00.000000Z")


def test_latency_policy_distinguishes_historical_and_observed() -> None:
    published = parse_utc("2026-01-01T00:00:00Z")
    retrieved = published + timedelta(days=2)
    historical = LatencyPolicy(publication_latency_seconds=60)
    observed = LatencyPolicy(publication_latency_seconds=60, retrieval_policy="observed")
    assert historical.availability(
        published_at=published, revised_at=None, retrieved_at=retrieved
    ) == published + timedelta(minutes=1)
    assert (
        observed.availability(published_at=published, revised_at=None, retrieved_at=retrieved)
        == retrieved
    )


def test_observation_round_trip_is_canonical() -> None:
    value = sample_observations()[0]
    restored = IntelligenceObservation.from_dict(value.to_dict())
    assert restored == value
    assert canonical_json(restored.to_dict()) == canonical_json(value.to_dict())
    with pytest.raises(ValueError, match="state"):
        replace(value, state="unknown")  # type: ignore[arg-type]


def test_entity_mapping_validity_is_half_open() -> None:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)
    mapping = EntityAssetMapping("entity", "ticker", "SYN", start, end)
    assert mapping.is_valid_at(start)
    assert not mapping.is_valid_at(end)
    assert (
        mapping.mapping_id == EntityAssetMapping("entity", "ticker", "SYN", start, end).mapping_id
    )

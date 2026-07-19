from __future__ import annotations

from dataclasses import replace
from datetime import timedelta

from tnl_intelligence.quant.features import (
    EVENT_FEATURE_VERSION,
    EXPOSURE_FEATURE_VERSION,
    aggregate_exposure,
    event_features,
    exposure_features,
)
from tnl_intelligence.quant.sample import sample_mappings, sample_observations
from tnl_intelligence.quant.temporal import parse_utc
from tnl_intelligence.quant.validation import validate_point_in_time


def test_validation_catches_documented_leakage_and_bias_classes() -> None:
    rows = sample_observations()
    boundary = parse_utc("2026-06-05T00:00:00Z")
    report = validate_point_in_time(
        [rows[0], rows[-1]],
        as_of=boundary,
        feature_rows=[{"featureTimestamp": "2026-06-06T00:00:00Z", "future_return": 0.1}],
        train_times=[parse_utc("2026-06-04T00:00:00Z")],
        test_times=[parse_utc("2026-06-03T00:00:00Z")],
        randomized_split=True,
        universe_is_current_only=True,
        forward_fill=True,
    )
    codes = {item.code for item in report.findings}
    assert {
        "future_availability",
        "future_feature",
        "outcome_in_features",
        "temporal_split_overlap",
        "randomized_temporal_split",
        "survivorship_universe",
        "silent_forward_fill",
    }.issubset(codes)
    assert not report.valid


def test_validation_catches_duplicate_and_invalid_mapping() -> None:
    row = sample_observations()[2]
    expired = replace(
        sample_mappings()[2],
        valid_from=parse_utc("2027-01-01T00:00:00Z"),
    )
    report = validate_point_in_time(
        [row, row], as_of=parse_utc("2026-07-01T00:00:00Z"), mappings=[expired]
    )
    codes = {item.code for item in report.findings}
    assert "duplicate_revision" in codes
    assert "duplicate_event" in codes
    assert "mapping_outside_validity" in codes


def test_validation_catches_ambiguous_mapping_and_historical_revision() -> None:
    rows = sample_observations()
    report = validate_point_in_time(
        [rows[0]],
        as_of=parse_utc("2026-06-02T00:00:00Z"),
        mappings=sample_mappings(),
        revision_history=rows,
    )
    assert {item.code for item in report.findings} == {"historical_revision_mismatch"}
    ambiguous = validate_point_in_time(
        [rows[2]],
        as_of=parse_utc("2026-06-05T00:00:00Z"),
        mappings=sample_mappings(),
    )
    assert "ambiguous_mapping" in {item.code for item in ambiguous.findings}


def test_event_features_are_revision_and_availability_aware() -> None:
    rows = sample_observations()
    features = event_features(rows[:2], as_of=parse_utc("2026-06-02T00:00:00Z"))
    assert [row["revisionCount"] for row in features] == [1, 2]
    assert all(row["featureVersion"] == EVENT_FEATURE_VERSION for row in features)
    assert all(
        parse_utc(str(row["featureTimestamp"])) <= parse_utc("2026-06-02T00:00:00Z")
        for row in features
    )


def test_exposure_features_respect_mapping_windows_and_flag_conflicts() -> None:
    rows = sample_observations()
    exposures = exposure_features(
        rows,
        sample_mappings(),
        as_of=parse_utc("2026-06-08T00:00:00Z"),
        decay_half_life=timedelta(days=2),
    )
    assert exposures
    assert all(row["featureVersion"] == EXPOSURE_FEATURE_VERSION for row in exposures)
    assert not any(
        row["asset"] == "SYN-P-OLD" and row["intelligenceId"] == "intel-policy" for row in exposures
    )
    summary = aggregate_exposure(exposures)
    assert sum(float(row["count"]) for row in summary) == len(exposures)

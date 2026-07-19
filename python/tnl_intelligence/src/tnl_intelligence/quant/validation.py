from __future__ import annotations

import hashlib
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from .models import EntityAssetMapping, IntelligenceObservation
from .temporal import parse_utc

Severity = Literal["info", "warning", "error"]
SEVERITY_ORDER: dict[Severity, int] = {"info": 0, "warning": 1, "error": 2}


@dataclass(frozen=True, slots=True)
class ValidationFinding:
    code: str
    severity: Severity
    message: str
    intelligence_id: str | None = None

    def to_dict(self) -> dict[str, str | None]:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "intelligenceId": self.intelligence_id,
        }


@dataclass(frozen=True, slots=True)
class ValidationReport:
    findings: tuple[ValidationFinding, ...]
    checked_rows: int

    @property
    def valid(self) -> bool:
        return not any(item.severity == "error" for item in self.findings)

    def fails(self, severity: Severity = "error") -> bool:
        threshold = SEVERITY_ORDER[severity]
        return any(SEVERITY_ORDER[item.severity] >= threshold for item in self.findings)

    def to_dict(self) -> dict[str, object]:
        counts = Counter(item.severity for item in self.findings)
        return {
            "valid": self.valid,
            "checkedRows": self.checked_rows,
            "counts": {name: counts.get(name, 0) for name in SEVERITY_ORDER},
            "findings": [item.to_dict() for item in self.findings],
        }


def validate_point_in_time(
    observations: Iterable[IntelligenceObservation],
    *,
    as_of: datetime,
    mappings: Iterable[EntityAssetMapping] = (),
    revision_history: Iterable[IntelligenceObservation] = (),
    feature_rows: Iterable[Mapping[str, object]] = (),
    train_times: Iterable[datetime] = (),
    test_times: Iterable[datetime] = (),
    backfill_acknowledged: bool = False,
    survivorship_acknowledged: bool = False,
    universe_is_current_only: bool = False,
    randomized_split: bool = False,
    forward_fill: bool = False,
    allow_ambiguous_mappings: bool = False,
) -> ValidationReport:
    boundary = parse_utc(as_of, field="as_of")
    rows = tuple(observations)
    mapping_rows = tuple(mappings)
    history_rows = tuple(revision_history)
    findings: list[ValidationFinding] = []
    keys = Counter(item.key for item in rows)
    event_ids = Counter(item.event_id for item in rows)
    for item in rows:
        if item.available_at > boundary:
            findings.append(
                ValidationFinding(
                    "future_availability",
                    "error",
                    "Observation became available after the dataset as_of boundary.",
                    item.intelligence_id,
                )
            )
        if item.tnl_revised_at and item.tnl_revised_at > item.available_at:
            findings.append(
                ValidationFinding(
                    "revision_after_availability",
                    "error",
                    "Revision timestamp is later than its availability timestamp.",
                    item.intelligence_id,
                )
            )
        if item.retrieved_at > item.available_at and "backfilled" in item.inferred_fields:
            severity: Severity = "info" if backfill_acknowledged else "error"
            findings.append(
                ValidationFinding(
                    "unacknowledged_backfill",
                    severity,
                    "Backfilled observation requires an explicit "
                    "contemporaneous-availability policy.",
                    item.intelligence_id,
                )
            )
        for entity_id in item.entities:
            relevant = [mapping for mapping in mapping_rows if mapping.entity_id == entity_id]
            valid_mappings = [
                mapping for mapping in relevant if mapping.is_valid_at(item.available_at)
            ]
            if relevant and not valid_mappings:
                findings.append(
                    ValidationFinding(
                        "mapping_outside_validity",
                        "error",
                        f"No {entity_id} mapping is valid at observation availability.",
                        item.intelligence_id,
                    )
                )
            if len(valid_mappings) > 1 and not allow_ambiguous_mappings:
                findings.append(
                    ValidationFinding(
                        "ambiguous_mapping",
                        "error",
                        f"Multiple mappings are valid for {entity_id}; select an explicit policy.",
                        item.intelligence_id,
                    )
                )
    expected: dict[str, IntelligenceObservation] = {}
    for candidate in history_rows:
        if candidate.available_at > boundary:
            continue
        previous = expected.get(candidate.intelligence_id)
        if previous is None or (
            candidate.available_at,
            candidate.revision,
            candidate.revision_id,
        ) > (previous.available_at, previous.revision, previous.revision_id):
            expected[candidate.intelligence_id] = candidate
    for item in rows:
        latest = expected.get(item.intelligence_id)
        if latest is not None and latest.revision_id != item.revision_id:
            findings.append(
                ValidationFinding(
                    "historical_revision_mismatch",
                    "error",
                    f"Selected {item.revision_id}, expected {latest.revision_id} at as_of.",
                    item.intelligence_id,
                )
            )
    for key, count in keys.items():
        if count > 1:
            findings.append(
                ValidationFinding("duplicate_revision", "error", f"Duplicate revision key: {key}")
            )
    for event_id, count in event_ids.items():
        if count > 1:
            findings.append(
                ValidationFinding(
                    "duplicate_event",
                    "warning",
                    f"Event {event_id} appears {count} times; declare an overlap "
                    "policy before joining.",
                )
            )
    outcome_names = {"return", "outcome", "target", "label", "future_return"}
    for index, row in enumerate(feature_rows):
        timestamp = row.get("featureTimestamp") or row.get("feature_timestamp")
        if timestamp is not None and (
            not isinstance(timestamp, str | datetime)
            or parse_utc(timestamp, field="feature_timestamp") > boundary
        ):
            findings.append(
                ValidationFinding("future_feature", "error", f"Feature row {index} exceeds as_of.")
            )
        leaked = outcome_names.intersection(name.lower() for name in row)
        if leaked:
            findings.append(
                ValidationFinding(
                    "outcome_in_features",
                    "error",
                    f"Feature row {index} contains outcome-like fields: {sorted(leaked)}.",
                )
            )
    train = sorted(parse_utc(item, field="train_time") for item in train_times)
    test = sorted(parse_utc(item, field="test_time") for item in test_times)
    if train and test and train[-1] >= test[0]:
        findings.append(
            ValidationFinding(
                "temporal_split_overlap",
                "error",
                "Training timestamps overlap or follow the test period.",
            )
        )
    if randomized_split:
        findings.append(
            ValidationFinding(
                "randomized_temporal_split",
                "error",
                "Randomized split is not allowed in guarded temporal workflows.",
            )
        )
    if universe_is_current_only and not survivorship_acknowledged:
        findings.append(
            ValidationFinding(
                "survivorship_universe",
                "error",
                "A current-only universe requires an explicit survivorship-bias override.",
            )
        )
    if forward_fill:
        findings.append(
            ValidationFinding(
                "silent_forward_fill",
                "error",
                "Forward-fill across unavailable periods must be modeled explicitly.",
            )
        )
    return ValidationReport(tuple(findings), len(rows))


def validate_snapshot_files(path: str | Path) -> ValidationReport:
    import json

    root = Path(path).expanduser().resolve()
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        return ValidationReport(
            (ValidationFinding("missing_manifest", "error", "manifest.json is missing."),), 0
        )
    value = json.loads(manifest_path.read_text(encoding="utf-8"))
    findings: list[ValidationFinding] = []
    checked = 0
    for item in value.get("files", []):
        relative = Path(str(item.get("path", "")))
        if relative.is_absolute() or ".." in relative.parts:
            findings.append(
                ValidationFinding("unsafe_manifest_path", "error", f"Unsafe path: {relative}")
            )
            continue
        target = root / relative
        if not target.is_file():
            findings.append(
                ValidationFinding("missing_data_file", "error", f"Missing data file: {relative}")
            )
            continue
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if digest != item.get("sha256"):
            findings.append(
                ValidationFinding("hash_mismatch", "error", f"Hash mismatch: {relative}")
            )
        checked += int(item.get("rowCount", 0))
    return ValidationReport(tuple(findings), checked)

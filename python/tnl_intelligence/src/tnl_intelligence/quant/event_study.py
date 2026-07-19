from __future__ import annotations

import math
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import fmean, stdev
from typing import Literal

from .models import IntelligenceObservation
from .temporal import format_utc, parse_utc

OverlapPolicy = Literal["keep", "first", "exclude"]


@dataclass(frozen=True, slots=True)
class MarketSession:
    label: str
    opens_at: datetime
    closes_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "opens_at", parse_utc(self.opens_at, field="opens_at"))
        object.__setattr__(self, "closes_at", parse_utc(self.closes_at, field="closes_at"))
        if self.closes_at <= self.opens_at:
            raise ValueError("session closes_at must be after opens_at")


@dataclass(frozen=True, slots=True)
class EventPanelResult:
    rows: tuple[dict[str, object], ...]
    exclusions: tuple[dict[str, str], ...]
    summary: Mapping[str, object]


def build_event_panel(
    observations: Iterable[IntelligenceObservation],
    sessions: Iterable[MarketSession],
    outcomes: Iterable[Mapping[str, object]],
    *,
    entity_assets: Mapping[str, str],
    latency: timedelta = timedelta(),
    pre: int = 1,
    post: int = 1,
    overlap: OverlapPolicy = "exclude",
) -> EventPanelResult:
    if pre < 0 or post < 0 or latency.total_seconds() < 0:
        raise ValueError("pre, post, and latency must be non-negative")
    ordered_sessions = tuple(sorted(sessions, key=lambda item: item.opens_at))
    outcome_index = {(str(item.get("asset")), str(item.get("session"))): item for item in outcomes}
    assignments: list[tuple[IntelligenceObservation, str, int]] = []
    exclusions: list[dict[str, str]] = []
    for item in sorted(observations, key=lambda row: (row.available_at, row.key)):
        tradable_at = item.available_at + latency
        index = next(
            (
                position
                for position, session in enumerate(ordered_sessions)
                if session.closes_at >= tradable_at
            ),
            None,
        )
        if index is None:
            exclusions.append({"intelligenceId": item.intelligence_id, "reason": "no_session"})
            continue
        assets = sorted(
            {entity_assets[entity] for entity in item.entities if entity in entity_assets}
            or set(item.assets)
        )
        if not assets:
            exclusions.append({"intelligenceId": item.intelligence_id, "reason": "no_asset"})
            continue
        assignments.extend((item, asset, index) for asset in assets)
    overlap_keys = Counter((asset, index) for _, asset, index in assignments)
    seen: set[tuple[str, int]] = set()
    rows: list[dict[str, object]] = []
    for item, asset, event_index in assignments:
        key = (asset, event_index)
        if overlap_keys[key] > 1 and overlap == "exclude":
            exclusions.append({"intelligenceId": item.intelligence_id, "reason": "overlap"})
            continue
        if key in seen and overlap == "first":
            exclusions.append({"intelligenceId": item.intelligence_id, "reason": "overlap_first"})
            continue
        seen.add(key)
        for offset in range(-pre, post + 1):
            session_index = event_index + offset
            if not 0 <= session_index < len(ordered_sessions):
                continue
            session = ordered_sessions[session_index]
            outcome = outcome_index.get((asset, session.label), {})
            value = outcome.get("outcome")
            benchmark = outcome.get("benchmark")
            abnormal = (
                float(value) - float(benchmark)
                if isinstance(value, int | float) and isinstance(benchmark, int | float)
                else None
            )
            rows.append(
                {
                    "intelligenceId": item.intelligence_id,
                    "revisionId": item.revision_id,
                    "eventId": item.event_id,
                    "asset": asset,
                    "eventAvailableAt": format_utc(item.available_at),
                    "tradableAt": format_utc(item.available_at + latency),
                    "session": session.label,
                    "windowOffset": offset,
                    "outcome": value,
                    "benchmark": benchmark,
                    "abnormalOutcome": abnormal,
                    "sample": str(outcome.get("sample", "exploratory")),
                }
            )
    abnormal_values: list[float] = []
    for row in rows:
        value = row.get("abnormalOutcome")
        if isinstance(value, int | float):
            abnormal_values.append(float(value))
    mean = fmean(abnormal_values) if abnormal_values else None
    standard_error = (
        stdev(abnormal_values) / math.sqrt(len(abnormal_values))
        if len(abnormal_values) > 1
        else None
    )
    summary: dict[str, object] = {
        "rowCount": len(rows),
        "eventCount": len({row["intelligenceId"] for row in rows}),
        "exclusionCount": len(exclusions),
        "missingOutcomeCount": sum(row["outcome"] is None for row in rows),
        "meanAbnormalOutcome": mean,
        "confidenceInterval95": (
            [mean - 1.96 * standard_error, mean + 1.96 * standard_error]
            if mean is not None and standard_error is not None
            else None
        ),
        "overlapPolicy": overlap,
        "disclaimer": "Descriptive research using user-supplied outcomes; not financial advice.",
    }
    return EventPanelResult(tuple(rows), tuple(exclusions), summary)

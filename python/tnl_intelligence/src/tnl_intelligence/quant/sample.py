from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from .models import EntityAssetMapping, IntelligenceObservation

SAMPLE_VERSION = "1.0.0"


def sample_observations() -> tuple[IntelligenceObservation, ...]:
    rows = [
        _row(
            "intel-energy",
            1,
            "energy-r1",
            "event-energy",
            "2026-06-01T08:00:00Z",
            title="Synthetic supply disruption reported",
            entities=("entity-energy",),
            assets=("SYN-E",),
            direction="negative",
            source_count=2,
        ),
        _row(
            "intel-energy",
            2,
            "energy-r2",
            "event-energy",
            "2026-06-01T12:00:00Z",
            title="Synthetic supply disruption estimate revised",
            entities=("entity-energy",),
            assets=("SYN-E",),
            direction="negative",
            state="corrected",
            source_count=3,
            revised=True,
        ),
        _row(
            "intel-policy",
            1,
            "policy-r1",
            "event-policy",
            "2026-06-03T21:30:00-04:00",
            title="Synthetic policy consultation opens",
            entities=("entity-policy",),
            assets=("SYN-P",),
            direction="uncertain",
            source_count=1,
        ),
        _row(
            "intel-late",
            1,
            "late-r1",
            "event-late",
            "2026-05-28T09:00:00Z",
            title="Synthetic late-arriving logistics notice",
            entities=("entity-logistics",),
            assets=("SYN-L",),
            direction="negative",
            source_count=1,
            retrieved="2026-06-05T09:00:00Z",
            inferred_fields=("backfilled",),
        ),
        _row(
            "intel-retracted",
            1,
            "retracted-r1",
            "event-retracted",
            "2026-06-04T10:00:00Z",
            title="Synthetic acquisition claim",
            entities=("entity-policy",),
            assets=("SYN-P",),
            direction="positive",
            source_count=1,
        ),
        _row(
            "intel-retracted",
            2,
            "retracted-r2",
            "event-retracted",
            "2026-06-06T10:00:00Z",
            title="Synthetic acquisition claim retracted",
            entities=("entity-policy",),
            assets=("SYN-P",),
            direction="uncertain",
            state="retracted",
            source_count=2,
            revised=True,
        ),
    ]
    return tuple(rows)


def sample_mappings() -> tuple[EntityAssetMapping, ...]:
    return (
        EntityAssetMapping("entity-energy", "synthetic", "SYN-E", _time("2020-01-01T00:00:00Z")),
        EntityAssetMapping(
            "entity-policy",
            "synthetic",
            "SYN-P-OLD",
            _time("2020-01-01T00:00:00Z"),
            _time("2026-06-03T00:00:00Z"),
            confidence=0.7,
        ),
        EntityAssetMapping(
            "entity-policy",
            "synthetic",
            "SYN-P",
            _time("2026-06-03T00:00:00Z"),
            confidence=0.8,
        ),
        EntityAssetMapping(
            "entity-policy",
            "synthetic-alt",
            "SYN-P-AMBIGUOUS",
            _time("2026-06-03T00:00:00Z"),
            confidence=0.4,
            relationship="indirect",
        ),
        EntityAssetMapping(
            "entity-logistics",
            "synthetic",
            "SYN-L",
            _time("2020-01-01T00:00:00Z"),
        ),
    )


def sample_sessions() -> tuple[dict[str, object], ...]:
    start = _time("2026-06-01T13:30:00Z")
    return tuple(
        {
            "label": f"SYN-{index + 1:02d}",
            "opensAt": (start + timedelta(days=index)).isoformat().replace("+00:00", "Z"),
            "closesAt": (start + timedelta(days=index, hours=6, minutes=30))
            .isoformat()
            .replace("+00:00", "Z"),
        }
        for index in range(10)
    )


def sample_outcomes() -> tuple[dict[str, object], ...]:
    assets = ("SYN-E", "SYN-P", "SYN-L")
    return tuple(
        {
            "asset": asset,
            "session": f"SYN-{index:02d}",
            "outcome": round(((index % 3) - 1) * 0.004 + offset * 0.001, 6),
            "benchmark": round(((index % 2) - 0.5) * 0.002, 6),
            "sample": "exploratory" if index < 7 else "out-of-sample",
        }
        for offset, asset in enumerate(assets)
        for index in range(1, 11)
    )


def _row(
    intelligence_id: str,
    revision: int,
    revision_id: str,
    event_id: str,
    available: str,
    *,
    title: str,
    entities: Sequence[str],
    assets: Sequence[str],
    direction: str,
    state: str = "active",
    source_count: int,
    retrieved: str | None = None,
    revised: bool = False,
    inferred_fields: Sequence[str] = (),
) -> IntelligenceObservation:
    available_at = _time(available)
    published_at = available_at - timedelta(minutes=15)
    return IntelligenceObservation.from_dict(
        {
            "intelligenceId": intelligence_id,
            "revision": revision,
            "revisionId": revision_id,
            "eventId": event_id,
            "eventType": "synthetic_development",
            "title": title,
            "summary": "Synthetic redistributable fixture; no third-party article text.",
            "category": "synthetic",
            "geography": "global",
            "language": "en",
            "consequenceRank": 0.65,
            "entities": list(entities),
            "assets": list(assets),
            "impactDirection": direction,
            "horizon": "short",
            "confidence": 0.75,
            "materiality": 0.6,
            "sourceCount": source_count,
            "eventTime": (published_at - timedelta(hours=1)).isoformat(),
            "sourcePublishedAt": (published_at - timedelta(minutes=5)).isoformat(),
            "tnlPublishedAt": published_at.isoformat(),
            "tnlRevisedAt": available_at.isoformat() if revised else None,
            "retrievedAt": retrieved or available_at.isoformat(),
            "availableAt": available_at.isoformat(),
            "state": state,
            "provenance": ["tnl-synthetic-fixture-v1"],
            "canonicalUrl": f"https://theneuralledger.com/synthetic/{intelligence_id}",
            "inferredFields": list(inferred_fields),
        }
    )


def _time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc)

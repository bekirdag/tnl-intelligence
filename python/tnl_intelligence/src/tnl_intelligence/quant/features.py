from __future__ import annotations

import math
from collections import defaultdict, deque
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta

from .models import EntityAssetMapping, IntelligenceObservation
from .temporal import format_utc, parse_utc

EVENT_FEATURE_VERSION = "1.0.0"
EXPOSURE_FEATURE_VERSION = "1.0.0"


def event_features(
    observations: Iterable[IntelligenceObservation],
    *,
    as_of: datetime,
    novelty_window: timedelta = timedelta(days=30),
) -> tuple[dict[str, object], ...]:
    boundary = parse_utc(as_of, field="as_of")
    rows = sorted(
        (item for item in observations if item.available_at <= boundary),
        key=lambda item: (item.available_at, item.key),
    )
    active: deque[IntelligenceObservation] = deque()
    entity_counts: defaultdict[str, int] = defaultdict(int)
    category_counts: defaultdict[str, int] = defaultdict(int)
    event_type_counts: defaultdict[str, int] = defaultdict(int)
    revision_counts: defaultdict[str, int] = defaultdict(int)
    result: list[dict[str, object]] = []
    for item in rows:
        cutoff = item.available_at - novelty_window
        while active and active[0].available_at < cutoff:
            expired = active.popleft()
            for entity in expired.entities:
                entity_counts[entity] -= 1
            if expired.category:
                category_counts[expired.category] -= 1
            event_type_counts[expired.event_type] -= 1
        related_count = sum(entity_counts[entity] for entity in set(item.entities))
        if item.category:
            related_count += category_counts[item.category]
        related_count += event_type_counts[item.event_type]
        revision_counts[item.intelligence_id] += 1
        lag_event = (
            (item.available_at - item.event_time).total_seconds()
            if item.event_time is not None
            else None
        )
        lag_source = (
            (item.available_at - item.source_published_at).total_seconds()
            if item.source_published_at is not None
            else None
        )
        result.append(
            {
                "intelligenceId": item.intelligence_id,
                "revisionId": item.revision_id,
                "eventId": item.event_id,
                "featureTimestamp": format_utc(item.available_at),
                "featureVersion": EVENT_FEATURE_VERSION,
                "novelty": 1.0 / (1.0 + related_count),
                "materiality": item.materiality,
                "consequenceRank": item.consequence_rank,
                "confidence": item.confidence,
                "corroborationCount": item.source_count,
                "revisionCount": revision_counts[item.intelligence_id],
                "secondsSinceEvent": lag_event,
                "secondsSinceSourcePublication": lag_source,
                "secondsSinceTnlPublication": (
                    item.available_at - item.tnl_published_at
                ).total_seconds(),
                "category": item.category,
                "geography": item.geography,
                "eventType": item.event_type,
            }
        )
        active.append(item)
        for entity in item.entities:
            entity_counts[entity] += 1
        if item.category:
            category_counts[item.category] += 1
        event_type_counts[item.event_type] += 1
    return tuple(result)


def exposure_features(
    observations: Iterable[IntelligenceObservation],
    mappings: Iterable[EntityAssetMapping],
    *,
    as_of: datetime,
    decay_half_life: timedelta = timedelta(days=7),
) -> tuple[dict[str, object], ...]:
    boundary = parse_utc(as_of, field="as_of")
    if decay_half_life.total_seconds() <= 0:
        raise ValueError("decay_half_life must be positive")
    map_by_entity: defaultdict[str, list[EntityAssetMapping]] = defaultdict(list)
    for mapping in mappings:
        map_by_entity[mapping.entity_id].append(mapping)
    result: list[dict[str, object]] = []
    directions: defaultdict[tuple[str, str], set[str]] = defaultdict(set)
    for item in sorted(observations, key=lambda row: (row.available_at, row.key)):
        if item.available_at > boundary:
            continue
        age = max(0.0, (boundary - item.available_at).total_seconds())
        decay = math.pow(0.5, age / decay_half_life.total_seconds())
        for entity_id in item.entities:
            valid = [
                mapping
                for mapping in map_by_entity[entity_id]
                if mapping.is_valid_at(item.available_at)
            ]
            for mapping in valid:
                direction = item.impact_direction or "uncertain"
                key = (entity_id, mapping.identifier)
                directions[key].add(direction)
                result.append(
                    {
                        "intelligenceId": item.intelligence_id,
                        "revisionId": item.revision_id,
                        "entityId": entity_id,
                        "mappingId": mapping.mapping_id,
                        "namespace": mapping.namespace,
                        "asset": mapping.identifier,
                        "relationship": mapping.relationship,
                        "direct": mapping.relationship == "direct",
                        "impactDirection": direction,
                        "horizon": item.horizon,
                        "confidence": item.confidence,
                        "decayWeight": decay,
                        "exposureWeight": decay
                        * (item.confidence if item.confidence is not None else 0.5)
                        * mapping.confidence,
                        "uncertain": direction == "uncertain" or item.confidence is None,
                        "contradictory": len(directions[key]) > 1,
                        "featureTimestamp": format_utc(item.available_at),
                        "featureVersion": EXPOSURE_FEATURE_VERSION,
                    }
                )
    contradictory = {
        key for key, values in directions.items() if len(values.difference({"uncertain"})) > 1
    }
    for row in result:
        key = (str(row["entityId"]), str(row["asset"]))
        row["contradictory"] = key in contradictory
    return tuple(result)


def aggregate_exposure(
    rows: Iterable[Mapping[str, object]], *, by: str = "asset"
) -> tuple[dict[str, object], ...]:
    totals: defaultdict[str, dict[str, float]] = defaultdict(
        lambda: {"count": 0.0, "weightedCount": 0.0}
    )
    for row in rows:
        key = str(row.get(by, ""))
        totals[key]["count"] += 1
        value = row.get("exposureWeight")
        totals[key]["weightedCount"] += float(value) if isinstance(value, int | float) else 0.0
    return tuple({by: key, **totals[key]} for key in sorted(totals))

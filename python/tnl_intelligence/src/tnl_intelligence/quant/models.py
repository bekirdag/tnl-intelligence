from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from ..models import Story
from .temporal import LatencyPolicy, format_utc, optional_utc, parse_utc

ObservationState = Literal["active", "corrected", "retracted"]


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def content_hash(value: object) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class EntityAssetMapping:
    entity_id: str
    namespace: str
    identifier: str
    valid_from: datetime
    valid_to: datetime | None = None
    source: str = "tnl"
    confidence: float = 1.0
    relationship: str = "direct"
    mapping_id: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "valid_from", parse_utc(self.valid_from, field="valid_from"))
        if self.valid_to is not None:
            object.__setattr__(self, "valid_to", parse_utc(self.valid_to, field="valid_to"))
            if self.valid_to <= self.valid_from:
                raise ValueError("valid_to must be after valid_from")
        if not self.entity_id or not self.namespace or not self.identifier:
            raise ValueError("entity_id, namespace, and identifier are required")
        if not 0 <= self.confidence <= 1:
            raise ValueError("confidence must be between 0 and 1")
        if not self.mapping_id:
            identity = [
                self.entity_id,
                self.namespace,
                self.identifier,
                format_utc(self.valid_from),
            ]
            object.__setattr__(self, "mapping_id", content_hash(identity)[:24])

    def is_valid_at(self, value: datetime) -> bool:
        timestamp = parse_utc(value)
        return self.valid_from <= timestamp and (self.valid_to is None or timestamp < self.valid_to)

    def to_dict(self) -> dict[str, object]:
        return {
            "mappingId": self.mapping_id,
            "entityId": self.entity_id,
            "namespace": self.namespace,
            "identifier": self.identifier,
            "validFrom": format_utc(self.valid_from),
            "validTo": format_utc(self.valid_to) if self.valid_to else None,
            "source": self.source,
            "confidence": self.confidence,
            "relationship": self.relationship,
        }


@dataclass(frozen=True, slots=True)
class IntelligenceObservation:
    intelligence_id: str
    revision: int
    revision_id: str
    event_id: str
    event_type: str
    title: str | None
    summary: str | None
    category: str | None
    geography: str | None
    language: str
    consequence_rank: float | None
    entities: tuple[str, ...]
    assets: tuple[str, ...]
    impact_paths: tuple[str, ...]
    impact_direction: str | None
    horizon: str | None
    confidence: float | None
    materiality: float | None
    source_count: int
    event_time: datetime | None
    source_published_at: datetime | None
    tnl_published_at: datetime
    tnl_revised_at: datetime | None
    retrieved_at: datetime
    available_at: datetime
    state: ObservationState
    provenance: tuple[str, ...]
    canonical_url: str
    inferred_fields: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for name in ("intelligence_id", "revision_id", "event_id", "event_type"):
            if not getattr(self, name):
                raise ValueError(f"{name} is required")
        if self.revision < 1:
            raise ValueError("revision must be at least 1")
        for name in ("tnl_published_at", "retrieved_at", "available_at"):
            object.__setattr__(self, name, parse_utc(getattr(self, name), field=name))
        for name in ("event_time", "source_published_at", "tnl_revised_at"):
            value = getattr(self, name)
            if value is not None:
                object.__setattr__(self, name, parse_utc(value, field=name))
        if self.available_at < self.tnl_published_at:
            raise ValueError("available_at cannot precede tnl_published_at")
        for name in ("confidence", "materiality"):
            value = getattr(self, name)
            if value is not None and not 0 <= value <= 1:
                raise ValueError(f"{name} must be between 0 and 1")
        if self.source_count < 0:
            raise ValueError("source_count must be non-negative")
        if self.state not in {"active", "corrected", "retracted"}:
            raise ValueError("state must be active, corrected, or retracted")

    @property
    def key(self) -> str:
        return f"{self.intelligence_id}:{self.revision_id}"

    def to_dict(self) -> dict[str, object]:
        return {
            "intelligenceId": self.intelligence_id,
            "revision": self.revision,
            "revisionId": self.revision_id,
            "eventId": self.event_id,
            "eventType": self.event_type,
            "title": self.title,
            "summary": self.summary,
            "category": self.category,
            "geography": self.geography,
            "language": self.language,
            "consequenceRank": self.consequence_rank,
            "entities": list(self.entities),
            "assets": list(self.assets),
            "impactPaths": list(self.impact_paths),
            "impactDirection": self.impact_direction,
            "horizon": self.horizon,
            "confidence": self.confidence,
            "materiality": self.materiality,
            "sourceCount": self.source_count,
            "eventTime": format_utc(self.event_time) if self.event_time else None,
            "sourcePublishedAt": (
                format_utc(self.source_published_at) if self.source_published_at else None
            ),
            "tnlPublishedAt": format_utc(self.tnl_published_at),
            "tnlRevisedAt": format_utc(self.tnl_revised_at) if self.tnl_revised_at else None,
            "retrievedAt": format_utc(self.retrieved_at),
            "availableAt": format_utc(self.available_at),
            "state": self.state,
            "provenance": list(self.provenance),
            "canonicalUrl": self.canonical_url,
            "inferredFields": list(self.inferred_fields),
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> IntelligenceObservation:
        def pick(*names: str, default: Any = None) -> Any:
            return next((value[name] for name in names if name in value), default)

        published = optional_utc(
            pick("tnlPublishedAt", "tnl_published_at", "publishedAt", "published_at"),
            field="tnl_published_at",
        )
        if published is None:
            raise ValueError("tnl_published_at is required")
        retrieved = optional_utc(
            pick("retrievedAt", "retrieved_at", default=published), field="retrieved_at"
        )
        assert retrieved is not None
        revised = optional_utc(
            pick("tnlRevisedAt", "tnl_revised_at", "updatedAt", "updated_at"),
            field="tnl_revised_at",
        )
        policy = LatencyPolicy()
        available = optional_utc(pick("availableAt", "available_at"), field="available_at")
        revision = int(pick("revision", default=1))
        intelligence_id = str(pick("intelligenceId", "intelligence_id", "id", default=""))
        revision_id = str(
            pick(
                "revisionId",
                "revision_id",
                default=f"{intelligence_id}-r{revision}",
            )
        )
        return cls(
            intelligence_id=intelligence_id,
            revision=revision,
            revision_id=revision_id,
            event_id=str(pick("eventId", "event_id", default=intelligence_id)),
            event_type=str(pick("eventType", "event_type", default="news")),
            title=_optional_str(pick("title")),
            summary=_optional_str(pick("summary", "excerpt")),
            category=_optional_str(pick("category")),
            geography=_optional_str(pick("geography")),
            language=str(pick("language", default="en")),
            consequence_rank=_optional_float(pick("consequenceRank", "consequence_rank")),
            entities=_strings(pick("entities", default=())),
            assets=_strings(pick("assets", "impactedAssets", default=())),
            impact_paths=_strings(pick("impactPaths", "impact_paths", default=())),
            impact_direction=_optional_str(pick("impactDirection", "impact_direction")),
            horizon=_optional_str(pick("horizon")),
            confidence=_optional_float(pick("confidence", "truthPosterior")),
            materiality=_optional_float(pick("materiality", "urgencyScore"), scale=True),
            source_count=int(pick("sourceCount", "source_count", default=0)),
            event_time=optional_utc(pick("eventTime", "event_time"), field="event_time"),
            source_published_at=optional_utc(
                pick("sourcePublishedAt", "source_published_at"), field="source_published_at"
            ),
            tnl_published_at=published,
            tnl_revised_at=revised,
            retrieved_at=retrieved,
            available_at=available
            or policy.availability(
                published_at=published, revised_at=revised, retrieved_at=retrieved
            ),
            state=str(pick("state", default="active")),  # type: ignore[arg-type]
            provenance=_strings(pick("provenance", default=())),
            canonical_url=str(
                pick(
                    "canonicalUrl",
                    "canonical_url",
                    default=f"https://theneuralledger.com/news/{intelligence_id}",
                )
            ),
            inferred_fields=_strings(pick("inferredFields", "inferred_fields", default=())),
        )

    @classmethod
    def from_story(
        cls,
        story: Story,
        *,
        retrieved_at: datetime | None = None,
        policy: LatencyPolicy | None = None,
    ) -> IntelligenceObservation:
        value = dict(story.raw)
        value.setdefault("id", story.id)
        value.setdefault("title", story.title)
        value.setdefault("excerpt", story.excerpt)
        value.setdefault("category", story.category)
        value.setdefault("publishedAt", story.published_at)
        value.setdefault("updatedAt", story.updated_at)
        value.setdefault("impactedAssets", list(story.impacted_assets))
        value.setdefault("impactPaths", list(story.impact_paths))
        value.setdefault("sourceCount", len(story.sources))
        value.setdefault("truthPosterior", story.truth_posterior)
        value.setdefault("urgencyScore", story.urgency_score)
        value["retrievedAt"] = format_utc(retrieved_at or datetime.now(timezone.utc))
        observation = cls.from_dict(value)
        selected_policy = policy or LatencyPolicy()
        return cls.from_dict(
            {
                **observation.to_dict(),
                "availableAt": format_utc(
                    selected_policy.availability(
                        published_at=observation.tnl_published_at,
                        revised_at=observation.tnl_revised_at,
                        retrieved_at=observation.retrieved_at,
                    )
                ),
            }
        )


@dataclass(frozen=True, slots=True)
class ManifestFile:
    path: str
    row_count: int
    sha256: str
    columns: tuple[str, ...]
    media_type: str = "application/x-ndjson"
    column_types: Mapping[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "path": self.path,
            "rowCount": self.row_count,
            "sha256": self.sha256,
            "columns": list(self.columns),
            "columnTypes": dict(self.column_types),
            "mediaType": self.media_type,
        }


@dataclass(frozen=True, slots=True)
class DatasetManifest:
    dataset_id: str
    created_at: datetime
    as_of: datetime
    query: Mapping[str, object]
    api_version: str
    schema_version: str
    source_cursor: str | None
    revision_watermark: str | None
    files: tuple[ManifestFile, ...]
    latency_policy: LatencyPolicy
    entity_map_version: str
    feature_versions: Mapping[str, str]
    access_tier: str
    license: str
    redistribution: str
    hindsight: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "datasetId": self.dataset_id,
            "createdAt": format_utc(self.created_at),
            "asOf": format_utc(self.as_of),
            "query": dict(self.query),
            "apiVersion": self.api_version,
            "schemaVersion": self.schema_version,
            "sourceCursor": self.source_cursor,
            "revisionWatermark": self.revision_watermark,
            "files": [item.to_dict() for item in self.files],
            "latencyPolicy": self.latency_policy.to_dict(),
            "entityMapVersion": self.entity_map_version,
            "featureVersions": dict(self.feature_versions),
            "accessTier": self.access_tier,
            "license": self.license,
            "redistribution": self.redistribution,
            "hindsight": self.hindsight,
            "disclaimer": "Research infrastructure only; not financial advice or execution.",
        }


def observation_columns() -> tuple[str, ...]:
    return tuple(observation_schema())


def observation_schema() -> dict[str, str]:
    return {
        "intelligenceId": "string",
        "revision": "integer",
        "revisionId": "string",
        "eventId": "string",
        "eventType": "string",
        "title": "string|null",
        "summary": "string|null",
        "category": "string|null",
        "geography": "string|null",
        "language": "string",
        "consequenceRank": "number|null",
        "entities": "array<string>",
        "assets": "array<string>",
        "impactPaths": "array<string>",
        "impactDirection": "string|null",
        "horizon": "string|null",
        "confidence": "number|null",
        "materiality": "number|null",
        "sourceCount": "integer",
        "eventTime": "timestamp[us,UTC]|null",
        "sourcePublishedAt": "timestamp[us,UTC]|null",
        "tnlPublishedAt": "timestamp[us,UTC]",
        "tnlRevisedAt": "timestamp[us,UTC]|null",
        "retrievedAt": "timestamp[us,UTC]",
        "availableAt": "timestamp[us,UTC]",
        "state": "active|corrected|retracted",
        "provenance": "array<string>",
        "canonicalUrl": "string",
        "inferredFields": "array<string>",
    }


def _strings(value: object) -> tuple[str, ...]:
    if not isinstance(value, Sequence) or isinstance(value, str | bytes):
        return ()
    return tuple(str(item) for item in value if item is not None)


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None and value != "" else None


def _optional_float(value: object, *, scale: bool = False) -> float | None:
    if not isinstance(value, int | float):
        return None
    result = float(value)
    return result / 100 if scale and result > 1 else result

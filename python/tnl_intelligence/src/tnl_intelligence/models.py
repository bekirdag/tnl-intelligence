from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class Story:
    id: str
    title: str | None = None
    slug: str | None = None
    excerpt: str | None = None
    body: str | None = None
    category: str | None = None
    published_at: str | None = None
    updated_at: str | None = None
    urgency_score: float | None = None
    truth_posterior: float | None = None
    verification_state: str | None = None
    impacted_assets: tuple[str, ...] = ()
    impacted_sectors: tuple[str, ...] = ()
    impact_paths: tuple[str, ...] = ()
    sources: tuple[Mapping[str, Any], ...] = ()
    claims: tuple[Mapping[str, Any], ...] = ()
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> Story:
        return cls(
            id=str(value.get("id", "")),
            title=_optional_string(value.get("title")),
            slug=_optional_string(value.get("slug")),
            excerpt=_optional_string(value.get("excerpt")),
            body=_optional_string(value.get("body")),
            category=_optional_string(value.get("category")),
            published_at=_optional_string(value.get("publishedAt") or value.get("date")),
            updated_at=_optional_string(value.get("updatedAt")),
            urgency_score=_optional_float(value.get("urgencyScore")),
            truth_posterior=_optional_float(value.get("truthPosterior")),
            verification_state=_optional_string(value.get("verificationState")),
            impacted_assets=_string_tuple(value.get("impactedAssets")),
            impacted_sectors=_string_tuple(value.get("impactedSectors")),
            impact_paths=_string_tuple(value.get("impactPaths")),
            sources=_mapping_tuple(value.get("sources")),
            claims=_mapping_tuple(value.get("claims")),
            raw=dict(value),
        )


@dataclass(frozen=True, slots=True)
class PageMetadata:
    page: int = 1
    page_size: int = 0
    offset: int = 0
    total_count: int = 0
    total_pages: int = 0
    has_more: bool = False
    cursor: str | None = None
    next_cursor: str | None = None

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> PageMetadata:
        return cls(
            page=_integer(value.get("page"), 1),
            page_size=_integer(value.get("page_size")),
            offset=_integer(value.get("offset")),
            total_count=_integer(value.get("total_count")),
            total_pages=_integer(value.get("total_pages")),
            has_more=bool(value.get("has_more", False)),
            cursor=_optional_string(value.get("cursor")),
            next_cursor=_optional_string(value.get("next_cursor")),
        )


@dataclass(frozen=True, slots=True)
class NewsPage:
    data: tuple[Story, ...]
    page: PageMetadata
    last_sync_at: str | None = None
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> NewsPage:
        rows = value.get("data")
        data = (
            tuple(Story.from_dict(row) for row in rows if isinstance(row, Mapping))
            if isinstance(rows, list)
            else ()
        )
        page = value.get("page")
        return cls(
            data=data,
            page=PageMetadata.from_dict(page if isinstance(page, Mapping) else {}),
            last_sync_at=_optional_string(value.get("lastSyncAt")),
            raw=dict(value),
        )


@dataclass(frozen=True, slots=True)
class RateLimit:
    limit: int | None
    remaining: int | None
    reset_at: str | None


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _optional_float(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) else None


def _integer(value: Any, default: int = 0) -> int:
    return int(value) if isinstance(value, int | float) else default


def _string_tuple(value: Any) -> tuple[str, ...]:
    return tuple(item for item in value if isinstance(item, str)) if isinstance(value, list) else ()


def _mapping_tuple(value: Any) -> tuple[Mapping[str, Any], ...]:
    return (
        tuple(dict(item) for item in value if isinstance(item, Mapping))
        if isinstance(value, list)
        else ()
    )

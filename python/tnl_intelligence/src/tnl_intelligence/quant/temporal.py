from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from .errors import TemporalIntegrityError

RetrievalPolicy = Literal["historical", "observed"]


def parse_utc(value: str | datetime, *, field: str = "timestamp") -> datetime:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as error:
            raise TemporalIntegrityError(f"{field} must be an ISO-8601 timestamp") from error
    elif isinstance(value, datetime):
        parsed = value
    else:
        raise TemporalIntegrityError(f"{field} must be a datetime or ISO-8601 string")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise TemporalIntegrityError(f"{field} must include a timezone")
    return parsed.astimezone(timezone.utc)


def optional_utc(value: object, *, field: str) -> datetime | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str | datetime):
        raise TemporalIntegrityError(f"{field} must be a datetime or ISO-8601 string")
    return parse_utc(value, field=field)


def format_utc(value: datetime) -> str:
    return parse_utc(value).isoformat(timespec="microseconds").replace("+00:00", "Z")


@dataclass(frozen=True, slots=True)
class LatencyPolicy:
    publication_latency_seconds: int = 0
    revision_latency_seconds: int = 0
    retrieval_policy: RetrievalPolicy = "historical"

    def __post_init__(self) -> None:
        if self.publication_latency_seconds < 0 or self.revision_latency_seconds < 0:
            raise ValueError("latency values must be non-negative")
        if self.retrieval_policy not in {"historical", "observed"}:
            raise ValueError("retrieval_policy must be historical or observed")

    def availability(
        self,
        *,
        published_at: datetime,
        revised_at: datetime | None,
        retrieved_at: datetime,
    ) -> datetime:
        base = revised_at or published_at
        seconds = self.revision_latency_seconds if revised_at else self.publication_latency_seconds
        available = parse_utc(base) + timedelta(seconds=seconds)
        if self.retrieval_policy == "observed":
            return max(available, parse_utc(retrieved_at))
        return available

    def to_dict(self) -> dict[str, object]:
        return {
            "publicationLatencySeconds": self.publication_latency_seconds,
            "revisionLatencySeconds": self.revision_latency_seconds,
            "retrievalPolicy": self.retrieval_policy,
        }

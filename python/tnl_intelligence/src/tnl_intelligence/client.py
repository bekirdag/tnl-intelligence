from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Iterator, Mapping
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import quote

import httpx

from .errors import (
    TnlAuthenticationError,
    TnlError,
    TnlRateLimitError,
    TnlTimeoutError,
)
from .models import NewsPage, RateLimit, Story

DEFAULT_BASE_URL = "https://theneuralledger.com"
RETRYABLE_STATUS_CODES = frozenset({408, 425, 429, 500, 502, 503, 504})


class TnlClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        retries: int = 2,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = _api_key(api_key)
        self._retries = _retries(retries)
        self.last_rate_limit: RateLimit | None = None
        self._client = httpx.Client(
            base_url=_base_url(base_url),
            timeout=timeout,
            transport=transport,
            headers=_headers(self._api_key),
        )

    def __repr__(self) -> str:
        return f"TnlClient(base_url={str(self._client.base_url)!r}, retries={self._retries})"

    def __enter__(self) -> TnlClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def list_news(self, **query: Any) -> NewsPage:
        return NewsPage.from_dict(self._request("GET", "/v1/news", params=_query(query)))

    def iterate_news(self, **query: Any) -> Iterator[Story]:
        cursor = query.pop("cursor", None)
        seen: set[str] = set()
        while True:
            page = self.list_news(**query, **({"cursor": cursor} if cursor else {}))
            yield from page.data
            cursor = page.page.next_cursor
            if not cursor or cursor in seen:
                return
            seen.add(cursor)

    def get_news(self, story: str, **query: Any) -> Story:
        return Story.from_dict(
            self._request("GET", f"/v1/news/{_path(story)}", params=_query(query))
        )

    def search_news(self, query: str, **filters: Any) -> NewsPage:
        if not query.strip():
            raise ValueError("query is required")
        return NewsPage.from_dict(
            self._request("GET", "/v1/search", params={"q": query, **_query(filters)})
        )

    def list_entities(self, query: str | None = None, *, limit: int = 50) -> dict[str, Any]:
        return self._request("GET", "/v1/entities", params=_clean({"q": query, "limit": limit}))

    def entity_stories(self, entity: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            self._request("GET", f"/v1/entities/{_path(entity)}/stories", params=_query(query))
        )

    def list_impact_paths(self, query: str | None = None, *, limit: int = 50) -> dict[str, Any]:
        return self._request("GET", "/v1/impact-paths", params=_clean({"q": query, "limit": limit}))

    def impact_path_stories(self, impact_path: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            self._request(
                "GET", f"/v1/impact-paths/{_path(impact_path)}/stories", params=_query(query)
            )
        )

    def asset_stories(self, ticker: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            self._request("GET", f"/v1/assets/{_path(ticker)}/stories", params=_query(query))
        )

    def get_filters(self) -> dict[str, Any]:
        return self._request("GET", "/v1/filters")

    def get_markets(self) -> dict[str, Any]:
        return self._request("GET", "/v1/markets")

    def get_account(self) -> dict[str, Any]:
        return self._request("GET", "/v1/me")

    def ask_ai(self, question: str) -> dict[str, Any]:
        if not question.strip():
            raise ValueError("question is required")
        return self._request("POST", "/v1/ai-terminal", json={"question": question})

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        for attempt in range(self._retries + 1):
            try:
                response = self._client.request(method, path, params=params, json=json)
                self.last_rate_limit = _rate_limit(response.headers)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < self._retries:
                    time.sleep(_retry_delay(attempt, response.headers))
                    continue
                return _decode(response)
            except httpx.TimeoutException as error:
                if attempt >= self._retries:
                    raise TnlTimeoutError("The Neural Ledger request timed out") from error
                time.sleep(_retry_delay(attempt))
            except httpx.RequestError as error:
                if attempt >= self._retries:
                    raise TnlError("The Neural Ledger request failed") from error
                time.sleep(_retry_delay(attempt))
        raise TnlError("The Neural Ledger request failed")


class AsyncTnlClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        retries: int = 2,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = _api_key(api_key)
        self._retries = _retries(retries)
        self.last_rate_limit: RateLimit | None = None
        self._client = httpx.AsyncClient(
            base_url=_base_url(base_url),
            timeout=timeout,
            transport=transport,
            headers=_headers(self._api_key),
        )

    def __repr__(self) -> str:
        return f"AsyncTnlClient(base_url={str(self._client.base_url)!r}, retries={self._retries})"

    async def __aenter__(self) -> AsyncTnlClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def list_news(self, **query: Any) -> NewsPage:
        return NewsPage.from_dict(await self._request("GET", "/v1/news", params=_query(query)))

    async def iterate_news(self, **query: Any) -> AsyncIterator[Story]:
        cursor = query.pop("cursor", None)
        seen: set[str] = set()
        while True:
            page = await self.list_news(**query, **({"cursor": cursor} if cursor else {}))
            for story in page.data:
                yield story
            cursor = page.page.next_cursor
            if not cursor or cursor in seen:
                return
            seen.add(cursor)

    async def get_news(self, story: str, **query: Any) -> Story:
        return Story.from_dict(
            await self._request("GET", f"/v1/news/{_path(story)}", params=_query(query))
        )

    async def search_news(self, query: str, **filters: Any) -> NewsPage:
        if not query.strip():
            raise ValueError("query is required")
        return NewsPage.from_dict(
            await self._request("GET", "/v1/search", params={"q": query, **_query(filters)})
        )

    async def list_entities(self, query: str | None = None, *, limit: int = 50) -> dict[str, Any]:
        return await self._request(
            "GET", "/v1/entities", params=_clean({"q": query, "limit": limit})
        )

    async def entity_stories(self, entity: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            await self._request(
                "GET", f"/v1/entities/{_path(entity)}/stories", params=_query(query)
            )
        )

    async def list_impact_paths(
        self, query: str | None = None, *, limit: int = 50
    ) -> dict[str, Any]:
        return await self._request(
            "GET", "/v1/impact-paths", params=_clean({"q": query, "limit": limit})
        )

    async def impact_path_stories(self, impact_path: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            await self._request(
                "GET", f"/v1/impact-paths/{_path(impact_path)}/stories", params=_query(query)
            )
        )

    async def asset_stories(self, ticker: str, **query: Any) -> NewsPage:
        return NewsPage.from_dict(
            await self._request("GET", f"/v1/assets/{_path(ticker)}/stories", params=_query(query))
        )

    async def get_filters(self) -> dict[str, Any]:
        return await self._request("GET", "/v1/filters")

    async def get_markets(self) -> dict[str, Any]:
        return await self._request("GET", "/v1/markets")

    async def get_account(self) -> dict[str, Any]:
        return await self._request("GET", "/v1/me")

    async def ask_ai(self, question: str) -> dict[str, Any]:
        if not question.strip():
            raise ValueError("question is required")
        return await self._request("POST", "/v1/ai-terminal", json={"question": question})

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        for attempt in range(self._retries + 1):
            try:
                response = await self._client.request(method, path, params=params, json=json)
                self.last_rate_limit = _rate_limit(response.headers)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < self._retries:
                    await asyncio.sleep(_retry_delay(attempt, response.headers))
                    continue
                return _decode(response)
            except httpx.TimeoutException as error:
                if attempt >= self._retries:
                    raise TnlTimeoutError("The Neural Ledger request timed out") from error
                await asyncio.sleep(_retry_delay(attempt))
            except httpx.RequestError as error:
                if attempt >= self._retries:
                    raise TnlError("The Neural Ledger request failed") from error
                await asyncio.sleep(_retry_delay(attempt))
        raise TnlError("The Neural Ledger request failed")


def _decode(response: httpx.Response) -> dict[str, Any]:
    try:
        value = response.json()
    except ValueError:
        value = {}
    if response.is_success:
        return value if isinstance(value, dict) else {"data": value}
    payload = value if isinstance(value, dict) else {}
    nested = payload.get("error")
    nested_error = nested if isinstance(nested, dict) else {}
    message = (
        nested_error.get("message")
        or (nested if isinstance(nested, str) else None)
        or payload.get("message")
        or f"The Neural Ledger API returned HTTP {response.status_code}"
    )
    options = {
        "status_code": response.status_code,
        "code": nested_error.get("code") or payload.get("code"),
        "details": nested_error.get("details") or payload.get("details"),
        "request_id": response.headers.get("x-request-id"),
        "retry_after": _retry_after(response.headers),
    }
    error_class = TnlError
    if response.status_code in {401, 403}:
        error_class = TnlAuthenticationError
    elif response.status_code == 429:
        error_class = TnlRateLimitError
    raise error_class(str(message), **options)


def _query(values: Mapping[str, Any]) -> dict[str, Any]:
    aliases = {
        "page_size": "page_size",
        "pageSize": "page_size",
        "impact_path": "impact_path",
        "impactPath": "impact_path",
        "published_since": "published_since",
        "publishedSince": "published_since",
        "published_until": "published_until",
        "publishedUntil": "published_until",
        "updated_since": "updated_since",
        "updatedSince": "updated_since",
        "updated_until": "updated_until",
        "updatedUntil": "updated_until",
    }
    return _clean({aliases.get(key, key): value for key, value in values.items()})


def _clean(values: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: ",".join(value) if isinstance(value, list | tuple) else value
        for key, value in values.items()
        if value is not None and value != ""
    }


def _path(value: str) -> str:
    if not value.strip():
        raise ValueError("path identifier is required")
    return quote(value.strip(), safe="")


def _headers(api_key: str) -> dict[str, str]:
    return {
        "authorization": f"Bearer {api_key}",
        "accept": "application/json",
        "user-agent": "tnl-intelligence-python/0.1.0",
    }


def _api_key(value: str) -> str:
    result = value.strip()
    if not result:
        raise ValueError("TNL API key is required")
    return result


def _base_url(value: str) -> str:
    url = httpx.URL(value)
    if url.scheme not in {"http", "https"}:
        raise ValueError("base_url must use http or https")
    return str(url).rstrip("/")


def _retries(value: int) -> int:
    if value < 0:
        raise ValueError("retries must be non-negative")
    return value


def _rate_limit(headers: httpx.Headers) -> RateLimit | None:
    limit = _optional_int(headers.get("x-ratelimit-limit"))
    remaining = _optional_int(headers.get("x-ratelimit-remaining"))
    reset_at = headers.get("x-ratelimit-reset")
    return (
        None
        if limit is None and remaining is None and reset_at is None
        else RateLimit(limit, remaining, reset_at)
    )


def _optional_int(value: str | None) -> int | None:
    try:
        return int(value) if value and value != "unlimited" else None
    except ValueError:
        return None


def _retry_after(headers: httpx.Headers) -> float | None:
    value = headers.get("retry-after")
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            return max(0.0, parsedate_to_datetime(value).timestamp() - time.time())
        except (TypeError, ValueError):
            return None


def _retry_delay(attempt: int, headers: httpx.Headers | None = None) -> float:
    retry_after = _retry_after(headers) if headers else None
    return min(retry_after if retry_after is not None else 0.25 * (2**attempt), 5.0)

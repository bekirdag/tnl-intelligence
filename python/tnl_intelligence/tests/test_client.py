from __future__ import annotations

import asyncio

import httpx
import pytest

from tnl_intelligence import (
    AsyncTnlClient,
    TnlAuthenticationError,
    TnlClient,
    TnlError,
    TnlRateLimitError,
)


def test_sync_client_maps_queries_and_keeps_key_out_of_repr() -> None:
    request: httpx.Request | None = None

    def handler(value: httpx.Request) -> httpx.Response:
        nonlocal request
        request = value
        return httpx.Response(
            200, json=_page([_story("one")]), headers={"x-ratelimit-remaining": "9"}
        )

    with TnlClient("very-secret", transport=httpx.MockTransport(handler)) as client:
        page = client.search_news("chips", page_size=5, published_since="2026-07-01T00:00:00Z")
        assert page.data[0].title == "Story one"
        assert "very-secret" not in repr(client)
        assert client.last_rate_limit is not None
        assert client.last_rate_limit.remaining == 9
    assert request is not None
    assert request.headers["authorization"] == "Bearer very-secret"
    assert request.url.params["q"] == "chips"
    assert request.url.params["page_size"] == "5"


def test_cursor_iteration_stops_after_the_last_page() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        cursor = request.url.params.get("cursor")
        return httpx.Response(
            200,
            json=_page(
                [_story("one" if cursor is None else "two")], "next" if cursor is None else None
            ),
        )

    with TnlClient("secret", transport=httpx.MockTransport(handler)) as client:
        assert [story.id for story in client.iterate_news()] == ["one", "two"]
    assert calls == 2


@pytest.mark.parametrize(
    ("status", "error_type"),
    [(401, TnlAuthenticationError), (429, TnlRateLimitError)],
)
def test_typed_http_errors(status: int, error_type: type[Exception]) -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(status, json={"error": {"code": "denied", "message": "Denied"}})
    )
    with (
        TnlClient("secret", retries=0, transport=transport) as client,
        pytest.raises(error_type, match="Denied"),
    ):
        client.list_news()


def test_async_client_and_iterator() -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        cursor = request.url.params.get("cursor")
        return httpx.Response(
            200,
            json=_page(
                [_story("one" if cursor is None else "two")], "next" if cursor is None else None
            ),
        )

    async def run() -> list[str]:
        transport = httpx.MockTransport(handler)
        async with AsyncTnlClient("secret", transport=transport) as client:
            return [story.id async for story in client.iterate_news()]

    assert asyncio.run(run()) == ["one", "two"]
    assert calls == 2


def test_transient_errors_are_retried() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503 if calls == 1 else 200, json={} if calls == 1 else _page([]))

    with TnlClient("secret", retries=1, transport=httpx.MockTransport(handler)) as client:
        assert client.list_news().data == ()
    assert calls == 2


def test_successful_malformed_json_is_a_typed_error() -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200,
            content=b'{"data":',
            headers={"content-type": "application/json", "x-request-id": "request-fixture"},
        )
    )
    with (
        TnlClient("secret", retries=0, transport=transport) as client,
        pytest.raises(TnlError, match="malformed JSON") as raised,
    ):
        client.list_news()
    assert raised.value.status_code == 200
    assert raised.value.request_id == "request-fixture"
    assert "secret" not in str(raised.value)


def _story(identifier: str) -> dict[str, object]:
    return {
        "id": identifier,
        "title": f"Story {identifier}",
        "impactedAssets": ["NVDA"],
        "sources": [{"name": "Source"}],
    }


def _page(data: list[dict[str, object]], next_cursor: str | None = None) -> dict[str, object]:
    return {
        "data": data,
        "page": {
            "page": 1,
            "page_size": 20,
            "offset": 0,
            "total_count": len(data),
            "total_pages": 1,
            "has_more": next_cursor is not None,
            "cursor": None,
            "next_cursor": next_cursor,
        },
    }

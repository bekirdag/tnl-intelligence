from __future__ import annotations

import asyncio
import importlib.metadata
import importlib.resources
import json
import os
from collections.abc import Callable
from typing import Any

from tnl_intelligence import (
    AsyncTnlClient,
    TnlAuthenticationError,
    TnlClient,
    TnlError,
    TnlRateLimitError,
    TnlTimeoutError,
)

BASE_URL = os.environ["TNL_BASE_URL"]
API_KEY = os.environ["TNL_API_KEY"]


def main() -> None:
    checks: list[str] = []
    with TnlClient(API_KEY, base_url=BASE_URL, retries=0) as client:
        assert API_KEY not in repr(client)
        assert [story.id for story in client.list_news(page_size=2).data] == [
            "story-1",
            "story-2",
        ]
        assert [story.id for story in client.iterate_news(page_size=2)] == [
            "story-1",
            "story-2",
            "story-3",
        ]
        assert client.get_news("story-1").raw["author"] == "TNL Bot"
        assert client.search_news("semiconductors").data[0].id == "story-1"
        assert client.list_entities()["data"][0]["id"] == "entity-semiconductors"
        assert client.list_impact_paths()["data"][0]["id"] == "impact-export-controls"
        assert client.asset_stories("NVDA").data[0].id == "story-1"
        assert client.get_account()["plan"]["id"] == "fixture"
        assert client.get_markets()["data"][0]["symbol"] == "TNLX"
        assert "controls" in client.ask_ai("What changed?")["data"]["answer"]
        expect(lambda: client.get_news("missing"), TnlError, 404)
        expect(lambda: client.get_news("conflict"), TnlError, 409)
        expect(lambda: client.search_news("scenario:429"), TnlRateLimitError, 429)
        expect(lambda: client.search_news("scenario:500"), TnlError, 500)
        expect(lambda: client.search_news("scenario:malformed"), TnlError)
        expect(lambda: client.search_news("scenario:reset"), TnlError)
        expect(lambda: client.search_news("   "), ValueError)

    with TnlClient("wrong_fixture_key", base_url=BASE_URL, retries=0) as client:
        expect(client.list_news, TnlAuthenticationError, 401)
    with TnlClient("tnl_forbidden_key", base_url=BASE_URL, retries=0) as client:
        expect(client.list_news, TnlAuthenticationError, 403)
    with TnlClient(API_KEY, base_url=BASE_URL, retries=0, timeout=0.02) as client:
        expect(lambda: client.search_news("scenario:slow"), TnlTimeoutError)
    checks.append("python-sync-success-and-errors")

    asyncio.run(async_checks())
    checks.append("python-async")
    assert importlib.metadata.version("tnl-intelligence") == "0.1.0"
    assert importlib.resources.files("tnl_intelligence").joinpath("py.typed").is_file()
    checks.append("python-package-metadata")
    print(json.dumps({"ok": True, "checks": checks}, sort_keys=True))


async def async_checks() -> None:
    async with AsyncTnlClient(API_KEY, base_url=BASE_URL, retries=0) as client:
        page = await client.list_news(page_size=2)
        assert [story.id for story in page.data] == ["story-1", "story-2"]
        stories = [story.id async for story in client.iterate_news(page_size=2)]
        assert stories == ["story-1", "story-2", "story-3"]


def expect(
    action: Callable[[], Any], error_type: type[Exception], status: int | None = None
) -> None:
    try:
        action()
    except error_type as error:
        if status is not None:
            assert getattr(error, "status_code", None) == status
        assert API_KEY not in str(error)
    else:
        raise AssertionError(f"expected {error_type.__name__}")


if __name__ == "__main__":
    main()

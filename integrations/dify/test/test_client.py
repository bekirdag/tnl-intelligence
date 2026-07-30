from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any

import requests

PLUGIN_ROOT = Path(__file__).resolve().parents[1] / "tnl_intelligence"
sys.path.insert(0, str(PLUGIN_ROOT))

from tools.client import MCP_URL, TnlClient, TnlError  # noqa: E402


class FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        payload: Any = None,
        *,
        headers: dict[str, str] | None = None,
        text: str | None = None,
    ) -> None:
        self.status_code = status_code
        self._payload = {} if payload is None else payload
        self.headers = headers or {"content-type": "application/json"}
        self.text = json.dumps(self._payload) if text is None else text

    def json(self) -> Any:
        return self._payload


class FakeSession:
    def __init__(self, *responses: FakeResponse | Exception) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"method": method, "url": url, **kwargs})
        if not self.responses:
            raise AssertionError("No fake response remains")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class TnlClientTest(unittest.TestCase):
    def test_search_uses_fixed_host_bearer_and_bounded_parameters(self) -> None:
        session = FakeSession(FakeResponse(payload={"data": [], "page": {}}))
        result = TnlClient("secret-value", session=session).search_intelligence(
            {"query": " supply chains ", "page_size": 25, "cursor": "next"}
        )
        self.assertEqual(result["data"], [])
        call = session.calls[0]
        self.assertEqual(call["url"], "https://theneuralledger.com/v1/search")
        self.assertEqual(call["headers"]["Authorization"], "Bearer secret-value")
        self.assertEqual(
            call["params"],
            {
                "q": "supply chains",
                "page_size": 25,
                "cursor": "next",
                "include": "sources,claims",
            },
        )
        self.assertEqual(call["timeout"], (5, 45))
        self.assertFalse(call["allow_redirects"])

    def test_get_intelligence_encodes_identifier(self) -> None:
        session = FakeSession(FakeResponse(payload={"data": {"id": "story"}}))
        TnlClient("key", session=session).get_intelligence({"id": "story/with space"})
        self.assertTrue(session.calls[0]["url"].endswith("/story%2Fwith%20space"))

    def test_exposure_rejects_unknown_kind_before_request(self) -> None:
        session = FakeSession()
        with self.assertRaisesRegex(TnlError, "kind must be"):
            TnlClient("key", session=session).get_exposure(
                {"kind": "url", "value": "https://example.com"}
            )
        self.assertEqual(session.calls, [])

    def test_recent_changes_requires_valid_timestamp(self) -> None:
        session = FakeSession()
        with self.assertRaisesRegex(TnlError, "ISO 8601"):
            TnlClient("key", session=session).list_recent_changes(
                {"since": "not-a-date"}
            )
        self.assertEqual(session.calls, [])

    def test_page_size_is_bounded(self) -> None:
        session = FakeSession()
        with self.assertRaisesRegex(TnlError, "1 to 100"):
            TnlClient("key", session=session).search_intelligence(
                {"query": "x", "page_size": 101}
            )

    def test_authentication_error_never_contains_key_or_body(self) -> None:
        key = "tnl_live_key_never_expose"
        session = FakeSession(
            FakeResponse(status_code=401, payload={"error": key}, text=key)
        )
        with self.assertRaises(TnlError) as raised:
            TnlClient(key, session=session).validate_credentials()
        self.assertNotIn(key, str(raised.exception))
        self.assertEqual(
            str(raised.exception),
            "The TNL API key is invalid or lacks the required scope.",
        )

    def test_timeout_is_normalized(self) -> None:
        session = FakeSession(requests.Timeout("secret diagnostic"))
        with self.assertRaisesRegex(TnlError, "timed out"):
            TnlClient("key", session=session).validate_credentials()

    def test_research_initializes_calls_and_cleans_session(self) -> None:
        session = FakeSession(
            FakeResponse(
                payload={"jsonrpc": "2.0", "id": "dify-initialize", "result": {}},
                headers={
                    "content-type": "application/json",
                    "mcp-session-id": "session-1",
                },
            ),
            FakeResponse(status_code=202, payload={}),
            FakeResponse(
                payload={
                    "jsonrpc": "2.0",
                    "id": "dify-tools-call",
                    "result": {
                        "structuredContent": {
                            "summary": "verified",
                            "citations": [{"url": "https://source.example"}],
                        }
                    },
                }
            ),
            FakeResponse(status_code=204, payload={}),
        )
        result = TnlClient("key", session=session).run_research(
            {
                "workflow": "what-changed",
                "question": "What changed?",
                "limit": 10,
            }
        )
        self.assertEqual(result["summary"], "verified")
        self.assertEqual([call["method"] for call in session.calls], ["POST", "POST", "POST", "DELETE"])
        self.assertTrue(all(call["url"] == MCP_URL for call in session.calls))
        tool_call = session.calls[2]["json"]
        self.assertEqual(tool_call["params"]["name"], "tnl_research_what_changed")
        self.assertEqual(
            tool_call["params"]["arguments"],
            {"query": "What changed?", "limit": 10},
        )
        self.assertEqual(session.calls[3]["headers"]["MCP-Session-Id"], "session-1")

    def test_mcp_event_stream_is_parsed(self) -> None:
        session = FakeSession(
            FakeResponse(
                headers={
                    "content-type": "text/event-stream",
                    "mcp-session-id": "sse-session",
                },
                text='event: message\ndata: {"jsonrpc":"2.0","id":"dify-initialize","result":{}}\n\n',
            ),
            FakeResponse(status_code=202, payload={}),
            FakeResponse(
                headers={"content-type": "text/event-stream"},
                text=(
                    'event: message\ndata: {"jsonrpc":"2.0","id":"dify-tools-call",'
                    '"result":{"content":[{"type":"text","text":"{\\"summary\\":\\"ok\\"}"}]}}\n\n'
                ),
            ),
            FakeResponse(status_code=204, payload={}),
        )
        result = TnlClient("key", session=session).run_research(
            {"workflow": "compare-sources", "question": "Compare this"}
        )
        self.assertEqual(result, {"summary": "ok"})

    def test_mcp_error_does_not_echo_upstream_message_or_key(self) -> None:
        key = "tnl_live_key_never_expose"
        session = FakeSession(
            FakeResponse(
                payload={
                    "jsonrpc": "2.0",
                    "id": "dify-initialize",
                    "error": {"code": -32000, "message": f"bad token {key}"},
                }
            )
        )
        with self.assertRaises(TnlError) as raised:
            TnlClient(key, session=session).run_research(
                {"workflow": "what-changed", "question": "What changed?"}
            )
        self.assertNotIn(key, str(raised.exception))
        self.assertEqual(
            str(raised.exception), "TNL MCP rejected the research request."
        )


if __name__ == "__main__":
    unittest.main()

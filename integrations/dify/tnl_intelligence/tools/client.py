from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import requests

API_BASE_URL = "https://theneuralledger.com"
MCP_URL = "https://mcp.theneuralledger.com/mcp"
REQUEST_TIMEOUT = (5, 45)
MAX_TEXT_LENGTH = 1_000
MAX_CURSOR_LENGTH = 4_096
MAX_PAGE_SIZE = 100

RESEARCH_TOOLS = {
    "what-changed": ("tnl_research_what_changed", "query"),
    "compare-sources": ("tnl_research_compare_sources", "query"),
    "validate-event": ("tnl_research_validate_event", "event"),
    "asset-exposure": ("tnl_research_asset_exposure", "assetName"),
    "operational-risk": ("tnl_research_operational_risk", "query"),
    "weekly-consequential": ("tnl_research_weekly_consequential", "query"),
}


class TnlError(ValueError):
    pass


def required_text(value: Any, name: str, *, maximum: int = MAX_TEXT_LENGTH) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TnlError(f"{name} is required.")
    normalized = value.strip()
    if len(normalized) > maximum:
        raise TnlError(f"{name} is too long.")
    return normalized


def optional_text(value: Any, name: str, *, maximum: int = MAX_TEXT_LENGTH) -> str | None:
    if value is None or value == "":
        return None
    return required_text(value, name, maximum=maximum)


def page_size(value: Any) -> int:
    if value in (None, ""):
        return 20
    if isinstance(value, bool):
        raise TnlError("page_size must be a number from 1 to 100.")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise TnlError("page_size must be a number from 1 to 100.") from error
    if parsed < 1 or parsed > MAX_PAGE_SIZE:
        raise TnlError("page_size must be a number from 1 to 100.")
    return parsed


def iso_timestamp(value: Any, name: str, *, required: bool = False) -> str | None:
    text = required_text(value, name) if required else optional_text(value, name)
    if text is None:
        return None
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise TnlError(f"{name} must be an ISO 8601 date or timestamp.") from error
    return text


def compact(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value not in (None, "")}


class TnlClient:
    def __init__(self, api_key: Any, *, session: requests.Session | None = None) -> None:
        self.api_key = required_text(api_key, "TNL API key", maximum=512)
        self.session = session or requests.Session()

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "User-Agent": "tnl-intelligence-dify/0.1.0",
        }

    def validate_credentials(self) -> None:
        self._api_get("/v1/me")

    def search_intelligence(self, values: dict[str, Any]) -> dict[str, Any]:
        query = required_text(values.get("query"), "query")
        include = "sources,claims,body" if bool(values.get("include_body")) else "sources,claims"
        return self._api_get(
            "/v1/search",
            compact(
                {
                    "q": query,
                    "page_size": page_size(values.get("page_size")),
                    "cursor": optional_text(
                        values.get("cursor"), "cursor", maximum=MAX_CURSOR_LENGTH
                    ),
                    "include": include,
                }
            ),
        )

    def get_intelligence(self, values: dict[str, Any]) -> dict[str, Any]:
        identifier = required_text(values.get("id"), "id", maximum=300)
        include = "sources,claims,body" if bool(values.get("include_body")) else "sources,claims"
        return self._api_get(
            f"/v1/news/{quote(identifier, safe='')}",
            {"include": include},
        )

    def list_recent_changes(self, values: dict[str, Any]) -> dict[str, Any]:
        return self._api_get(
            "/v1/news",
            compact(
                {
                    "updated_since": iso_timestamp(values.get("since"), "since", required=True),
                    "page_size": page_size(values.get("page_size")),
                    "cursor": optional_text(
                        values.get("cursor"), "cursor", maximum=MAX_CURSOR_LENGTH
                    ),
                    "sort": "pipeline",
                    "include": "sources,claims",
                }
            ),
        )

    def get_exposure(self, values: dict[str, Any]) -> dict[str, Any]:
        kind = required_text(values.get("kind"), "kind", maximum=32)
        resources = {
            "entity": "entities",
            "asset": "assets",
            "impact_path": "impact-paths",
        }
        if kind not in resources:
            raise TnlError("kind must be entity, asset, or impact_path.")
        identifier = required_text(values.get("value"), "value", maximum=300)
        return self._api_get(
            f"/v1/{resources[kind]}/{quote(identifier, safe='')}/stories",
            compact(
                {
                    "page_size": page_size(values.get("page_size")),
                    "cursor": optional_text(
                        values.get("cursor"), "cursor", maximum=MAX_CURSOR_LENGTH
                    ),
                    "include": "sources,claims",
                }
            ),
        )

    def run_research(self, values: dict[str, Any]) -> dict[str, Any]:
        workflow = required_text(values.get("workflow"), "workflow", maximum=64)
        mapped = RESEARCH_TOOLS.get(workflow)
        if mapped is None:
            raise TnlError("workflow is not supported.")
        tool_name, question_key = mapped
        question = required_text(values.get("question"), "question")
        arguments = compact(
            {
                question_key: question,
                "from": iso_timestamp(values.get("from"), "from"),
                "to": iso_timestamp(values.get("to"), "to"),
                "limit": page_size(values.get("limit")),
            }
        )
        return self._call_mcp_tool(tool_name, arguments)

    def get_weekly_edition(self, values: dict[str, Any]) -> dict[str, Any]:
        ending_text = iso_timestamp(values.get("week_ending"), "week_ending")
        if ending_text is None:
            ending = datetime.now(timezone.utc)
            ending_text = ending.isoformat().replace("+00:00", "Z")
        else:
            ending = datetime.fromisoformat(ending_text.replace("Z", "+00:00"))
            if ending.tzinfo is None:
                ending = ending.replace(tzinfo=timezone.utc)
        start = (ending - timedelta(days=7)).isoformat().replace("+00:00", "Z")
        filters = [
            value
            for value in (
                optional_text(values.get("category"), "category", maximum=200),
                optional_text(values.get("geography"), "geography", maximum=200),
            )
            if value
        ]
        question = "What were the most consequential developments in this period?"
        if filters:
            question += f" Focus on: {', '.join(filters)}."
        return self._call_mcp_tool(
            "tnl_research_weekly_consequential",
            {
                "query": question,
                "weekStart": start,
                "limit": page_size(values.get("limit")),
            },
        )

    def _api_get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self._request(
            "GET",
            f"{API_BASE_URL}{path}",
            headers=self.headers,
            params=params,
        )
        return self._json_object(response)

    def _call_mcp_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        base_headers = {
            **self.headers,
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-06-18",
        }
        initialized = self._mcp_request(
            base_headers,
            {
                "jsonrpc": "2.0",
                "id": "dify-initialize",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "tnl-intelligence-dify",
                        "version": "0.1.0",
                    },
                },
            },
        )
        session_id = initialized.headers.get("mcp-session-id")
        headers = (
            {**base_headers, "MCP-Session-Id": session_id}
            if session_id
            else base_headers
        )
        try:
            self._mcp_request(
                headers,
                {
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized",
                },
                expect_payload=False,
            )
            called = self._mcp_request(
                headers,
                {
                    "jsonrpc": "2.0",
                    "id": "dify-tools-call",
                    "method": "tools/call",
                    "params": {"name": name, "arguments": arguments},
                },
            )
            payload = self._mcp_payload(called)
            result = payload.get("result")
            if not isinstance(result, dict):
                raise TnlError("TNL research returned an invalid result.")
            if result.get("isError"):
                raise TnlError("TNL research failed. Review the inputs and account scope.")
            structured = result.get("structuredContent")
            if isinstance(structured, dict):
                return structured
            text = self._mcp_text(result)
            if not text:
                raise TnlError("TNL research returned an empty result.")
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return {"summary": text}
            if not isinstance(parsed, dict):
                return {"result": parsed}
            return parsed
        finally:
            if session_id:
                try:
                    self._request("DELETE", MCP_URL, headers=headers)
                except TnlError:
                    pass

    def _mcp_request(
        self,
        headers: dict[str, str],
        payload: dict[str, Any],
        *,
        expect_payload: bool = True,
    ) -> requests.Response:
        response = self._request("POST", MCP_URL, headers=headers, json=payload)
        if expect_payload:
            parsed = self._mcp_payload(response)
            error = parsed.get("error")
            if isinstance(error, dict):
                raise TnlError("TNL MCP rejected the research request.")
        return response

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        try:
            response = self.session.request(
                method,
                url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=False,
                **kwargs,
            )
        except requests.Timeout as error:
            raise TnlError("TNL request timed out. Try again.") from error
        except requests.RequestException as error:
            raise TnlError("TNL is temporarily unavailable. Try again.") from error
        if response.status_code in (401, 403):
            raise TnlError("The TNL API key is invalid or lacks the required scope.")
        if response.status_code == 404:
            raise TnlError("The requested TNL resource was not found.")
        if response.status_code == 429:
            raise TnlError("The TNL request limit has been reached. Try again later.")
        if response.status_code >= 500:
            raise TnlError("TNL is temporarily unavailable. Try again.")
        if response.status_code < 200 or response.status_code >= 300:
            raise TnlError(f"TNL rejected the request with HTTP {response.status_code}.")
        return response

    @staticmethod
    def _json_object(response: requests.Response) -> dict[str, Any]:
        try:
            value = response.json()
        except (ValueError, requests.JSONDecodeError) as error:
            raise TnlError("TNL returned an invalid JSON response.") from error
        if not isinstance(value, dict):
            raise TnlError("TNL returned an invalid JSON response.")
        return value

    @staticmethod
    def _mcp_payload(response: requests.Response) -> dict[str, Any]:
        text = response.text.strip()
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type or text.startswith("event:"):
            data_lines = [
                line[5:].strip()
                for line in text.splitlines()
                if line.startswith("data:")
            ]
            if not data_lines:
                raise TnlError("TNL MCP returned an invalid event stream.")
            text = data_lines[-1]
        try:
            value = json.loads(text)
        except json.JSONDecodeError as error:
            raise TnlError("TNL MCP returned invalid JSON.") from error
        if not isinstance(value, dict):
            raise TnlError("TNL MCP returned an invalid response.")
        return value

    @staticmethod
    def _mcp_text(result: dict[str, Any]) -> str:
        content = result.get("content")
        if not isinstance(content, list):
            return ""
        return "\n".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict)
            and item.get("type") == "text"
            and isinstance(item.get("text"), str)
        ).strip()

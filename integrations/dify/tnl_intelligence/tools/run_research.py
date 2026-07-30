from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from tools.client import TnlClient


class RunResearchTool(Tool):
    def _invoke(
        self, tool_parameters: dict[str, Any]
    ) -> Generator[ToolInvokeMessage, None, None]:
        result = TnlClient(self.runtime.credentials.get("tnl_api_key")).run_research(
            tool_parameters
        )
        yield self.create_variable_message("result", result)


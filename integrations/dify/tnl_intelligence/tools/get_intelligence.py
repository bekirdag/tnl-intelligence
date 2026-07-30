from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from tools.client import TnlClient


class GetIntelligenceTool(Tool):
    def _invoke(
        self, tool_parameters: dict[str, Any]
    ) -> Generator[ToolInvokeMessage, None, None]:
        result = TnlClient(self.runtime.credentials.get("tnl_api_key")).get_intelligence(
            tool_parameters
        )
        yield self.create_variable_message("result", result)


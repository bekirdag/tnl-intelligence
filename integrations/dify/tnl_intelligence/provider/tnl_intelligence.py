from typing import Any

from dify_plugin import ToolProvider
from dify_plugin.errors.tool import ToolProviderCredentialValidationError

from tools.client import TnlClient, TnlError


class TnlIntelligenceProvider(ToolProvider):
    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        try:
            TnlClient(credentials.get("tnl_api_key")).validate_credentials()
        except TnlError as error:
            raise ToolProviderCredentialValidationError(str(error)) from error


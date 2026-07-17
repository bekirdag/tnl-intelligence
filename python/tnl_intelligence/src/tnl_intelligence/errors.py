from __future__ import annotations

from typing import Any


class TnlError(Exception):
    """Base error returned by the TNL SDK."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        details: Any = None,
        request_id: str | None = None,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details
        self.request_id = request_id
        self.retry_after = retry_after


class TnlAuthenticationError(TnlError):
    """The API key is missing, invalid, or not authorized."""


class TnlRateLimitError(TnlError):
    """The account has reached a quota or rate limit."""


class TnlTimeoutError(TnlError):
    """A TNL request exceeded its configured timeout."""

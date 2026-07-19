from __future__ import annotations

import hashlib
import hmac
import re
import time
from collections.abc import Mapping, MutableSet
from dataclasses import dataclass


@dataclass(frozen=True)
class VerifiedWebhook:
    delivery_id: str
    key_id: str
    timestamp: int


class WebhookVerificationError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def verify_webhook(
    raw_body: bytes,
    headers: Mapping[str, str],
    keys: Mapping[str, bytes],
    *,
    now: int | None = None,
    tolerance_seconds: int = 300,
    seen_delivery_ids: MutableSet[str] | None = None,
) -> VerifiedWebhook:
    normalized = {key.lower(): value for key, value in headers.items()}
    delivery_id = _header(normalized, "tnl-webhook-id")
    key_id = _header(normalized, "tnl-webhook-key-id")
    timestamp_text = _header(normalized, "tnl-webhook-timestamp")
    supplied = _header(normalized, "tnl-webhook-signature")
    if re.fullmatch(r"dlv_[A-Za-z0-9_-]{12,100}", delivery_id) is None:
        raise WebhookVerificationError("invalid_id")
    if re.fullmatch(r"key_[A-Za-z0-9_-]{8,100}", key_id) is None:
        raise WebhookVerificationError("unknown_key")
    try:
        timestamp = int(timestamp_text)
    except ValueError as error:
        raise WebhookVerificationError("invalid_timestamp") from error
    current = int(time.time()) if now is None else now
    if not 1 <= tolerance_seconds <= 86_400:
        raise ValueError("tolerance_seconds is out of range")
    if abs(current - timestamp) > tolerance_seconds:
        raise WebhookVerificationError("stale_timestamp")
    secret = keys.get(key_id)
    if secret is None:
        raise WebhookVerificationError("unknown_key")
    if len(secret) < 32:
        raise ValueError("webhook secret must be at least 32 bytes")
    match = re.fullmatch(r"v1=([a-f0-9]{64})", supplied)
    if match is None:
        raise WebhookVerificationError("invalid_signature")
    prefix = f"v1.{timestamp}.{delivery_id}.".encode()
    expected = hmac.new(secret, prefix + raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, match.group(1)):
        raise WebhookVerificationError("invalid_signature")
    if seen_delivery_ids is not None:
        if delivery_id in seen_delivery_ids:
            raise WebhookVerificationError("duplicate_delivery")
        seen_delivery_ids.add(delivery_id)
    return VerifiedWebhook(delivery_id=delivery_id, key_id=key_id, timestamp=timestamp)


def _header(headers: Mapping[str, str], name: str) -> str:
    value = headers.get(name)
    if value is None or len(value) > 500:
        raise WebhookVerificationError("missing_header")
    return value

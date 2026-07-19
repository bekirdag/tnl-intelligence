from __future__ import annotations

import hashlib
import hmac
import json
from base64 import urlsafe_b64decode
from pathlib import Path

import pytest

from tnl_intelligence import WebhookVerificationError, verify_webhook


def signed(raw_body: bytes, secret: bytes, timestamp: int = 1_721_307_600) -> dict[str, str]:
    delivery_id = "dlv_abcdefghijklmnop"
    digest = hmac.new(
        secret,
        f"v1.{timestamp}.{delivery_id}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return {
        "TNL-Webhook-Id": delivery_id,
        "TNL-Webhook-Timestamp": str(timestamp),
        "TNL-Webhook-Key-Id": "key_current123",
        "TNL-Webhook-Signature": f"v1={digest}",
    }


def test_verifies_raw_body_and_rejects_duplicate_or_tampered_payload() -> None:
    raw_body = b'{"id":"evt_fixture123456789"}'
    secret = bytes([7]) * 32
    headers = signed(raw_body, secret)
    seen: set[str] = set()
    verified = verify_webhook(
        raw_body,
        headers,
        {"key_current123": secret},
        now=1_721_307_600,
        seen_delivery_ids=seen,
    )
    assert verified.delivery_id == "dlv_abcdefghijklmnop"
    with pytest.raises(WebhookVerificationError, match="duplicate_delivery"):
        verify_webhook(
            raw_body,
            headers,
            {"key_current123": secret},
            now=1_721_307_600,
            seen_delivery_ids=seen,
        )
    with pytest.raises(WebhookVerificationError, match="invalid_signature"):
        verify_webhook(
            raw_body + b" ",
            headers,
            {"key_current123": secret},
            now=1_721_307_600,
        )


def test_rejects_stale_timestamp_and_unknown_key() -> None:
    raw_body = b"{}"
    secret = bytes([4]) * 32
    headers = signed(raw_body, secret)
    with pytest.raises(WebhookVerificationError, match="stale_timestamp"):
        verify_webhook(raw_body, headers, {"key_current123": secret}, now=1_721_308_000)
    with pytest.raises(WebhookVerificationError, match="unknown_key"):
        verify_webhook(raw_body, headers, {}, now=1_721_307_600)


def test_verifies_canonical_cross_language_fixture() -> None:
    path = Path(__file__).parents[3] / "test" / "fixtures" / "webhooks" / "signed-published-v1.json"
    corpus = json.loads(path.read_text())
    key = urlsafe_b64decode(corpus["testKeyBase64url"] + "=")
    verified = verify_webhook(
        corpus["rawBody"].encode(),
        corpus["headers"],
        {"key_current123": key},
        now=int(corpus["headers"]["TNL-Webhook-Timestamp"]),
    )
    assert verified.delivery_id == corpus["headers"]["TNL-Webhook-Id"]
    assert json.loads(corpus["rawBody"]) == corpus["event"]

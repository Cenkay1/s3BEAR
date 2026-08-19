"""Unit tests for pure logic in app.services.webhook."""
import hashlib
import hmac
import json
from datetime import datetime, timezone

import pytest

from app.services import webhook


class TestSignPayload:
    def test_matches_manual_hmac(self):
        secret = "shh"
        body = b'{"a":1}'
        expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        assert webhook.sign_payload(secret, body) == expected

    def test_changes_with_body(self):
        assert webhook.sign_payload("s", b"a") != webhook.sign_payload("s", b"b")

    def test_changes_with_secret(self):
        assert webhook.sign_payload("s1", b"a") != webhook.sign_payload("s2", b"a")


class TestEventMatches:
    def test_exact_match(self):
        assert webhook.event_matches(["upload", "delete"], "upload") is True

    def test_no_match(self):
        assert webhook.event_matches(["upload"], "delete") is False

    def test_wildcard_matches_everything(self):
        assert webhook.event_matches(["*"], "anything") is True

    def test_empty_matches_nothing(self):
        assert webhook.event_matches([], "upload") is False


class TestNextRetryAt:
    def test_returns_increasing_delays(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        r1 = webhook.next_retry_at(1, now)
        r2 = webhook.next_retry_at(2, now)
        r3 = webhook.next_retry_at(3, now)
        assert r1 is not None and r2 is not None and r3 is not None
        assert now < r1 < r2 < r3

    def test_exhausted_returns_none(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        # max attempts is 4 -> after the 4th attempt, no further retry
        assert webhook.next_retry_at(4, now) is None
        assert webhook.next_retry_at(99, now) is None

    def test_timezone_aware(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        assert webhook.next_retry_at(1, now).tzinfo is not None


class TestBuildPayload:
    def test_shape(self):
        p = webhook.build_payload(
            event="upload",
            user_id="u1",
            user_email="a@b.com",
            bucket="bkt",
            object_key="k.png",
            details={"size": 10},
        )
        assert p["event"] == "upload"
        assert p["actor"] == {"user_id": "u1", "email": "a@b.com"}
        assert p["bucket"] == "bkt"
        assert p["object_key"] == "k.png"
        assert p["details"] == {"size": 10}
        assert "timestamp" in p
        # must be JSON-serializable
        json.dumps(p)

    def test_system_actor(self):
        p = webhook.build_payload(event="cleanup", user_id=None, user_email="system",
                                  bucket=None, object_key=None, details=None)
        assert p["actor"]["user_id"] is None
        assert p["actor"]["email"] == "system"

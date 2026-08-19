"""Unit tests for the pure logic in app.services.share.

These cover token generation/hashing and expiry parsing — the highest
bug-risk pure functions. DB-touching helpers are exercised via integration.
"""
from datetime import datetime, timezone

import pytest

from app.services import share


class TestGenerateToken:
    def test_returns_url_safe_string(self):
        token = share.generate_token()
        assert isinstance(token, str)
        assert token  # non-empty
        # url-safe base64 alphabet: letters, digits, - and _
        assert all(c.isalnum() or c in "-_" for c in token)

    def test_tokens_are_unique(self):
        tokens = {share.generate_token() for _ in range(1000)}
        assert len(tokens) == 1000

    def test_token_has_sufficient_entropy(self):
        # token_urlsafe(32) -> ~43 chars
        assert len(share.generate_token()) >= 40


class TestHashToken:
    def test_is_sha256_hex(self):
        h = share.hash_token("hello")
        assert h == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        assert len(h) == 64

    def test_is_deterministic(self):
        assert share.hash_token("abc") == share.hash_token("abc")

    def test_differs_by_input(self):
        assert share.hash_token("abc") != share.hash_token("abd")


class TestParseExpiresIn:
    @pytest.mark.parametrize("value,delta_seconds", [
        ("1h", 3600),
        ("24h", 86400),
        ("7d", 604800),
        ("30d", 2592000),
    ])
    def test_shorthands(self, value, delta_seconds):
        before = datetime.now(timezone.utc)
        result = share.parse_expires_in(value)
        after = datetime.now(timezone.utc)
        assert result is not None
        assert result.tzinfo is not None  # timezone-aware
        expected_low = before.timestamp() + delta_seconds
        expected_high = after.timestamp() + delta_seconds
        assert expected_low <= result.timestamp() <= expected_high

    def test_none_means_never(self):
        assert share.parse_expires_in(None) is None

    def test_never_keyword_means_never(self):
        assert share.parse_expires_in("never") is None

    def test_empty_string_uses_default_7d(self):
        result = share.parse_expires_in("")
        assert result is not None
        # ~7 days out
        delta = result.timestamp() - datetime.now(timezone.utc).timestamp()
        assert 604800 - 5 <= delta <= 604800 + 5

    def test_integer_seconds(self):
        result = share.parse_expires_in(3600)
        assert result is not None
        delta = result.timestamp() - datetime.now(timezone.utc).timestamp()
        assert 3595 <= delta <= 3605

    def test_numeric_string_seconds(self):
        result = share.parse_expires_in("3600")
        assert result is not None
        delta = result.timestamp() - datetime.now(timezone.utc).timestamp()
        assert 3595 <= delta <= 3605

    def test_invalid_unit_raises(self):
        with pytest.raises(ValueError):
            share.parse_expires_in("5y")

    def test_negative_seconds_raises(self):
        with pytest.raises(ValueError):
            share.parse_expires_in(-100)

    def test_zero_raises(self):
        with pytest.raises(ValueError):
            share.parse_expires_in(0)

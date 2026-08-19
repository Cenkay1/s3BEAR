"""Unit tests for pure logic in app.services.api_token."""
from datetime import datetime, timedelta, timezone

from app.services import api_token


class TestGenerateToken:
    def test_has_pat_prefix(self):
        assert api_token.generate_token().startswith("s3bear_pat_")

    def test_secret_portion_is_url_safe(self):
        secret = api_token.generate_token()[len("s3bear_pat_"):]
        assert secret
        assert all(c.isalnum() or c in "-_" for c in secret)

    def test_tokens_are_unique(self):
        assert len({api_token.generate_token() for _ in range(1000)}) == 1000


class TestLooksLikePat:
    def test_recognizes_pat(self):
        assert api_token.looks_like_pat("s3bear_pat_abc") is True

    def test_rejects_jwt(self):
        assert api_token.looks_like_pat("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x.y") is False

    def test_rejects_empty(self):
        assert api_token.looks_like_pat("") is False


class TestTokenPrefix:
    def test_prefix_is_display_hint(self):
        tok = "s3bear_pat_ABCDEFGH_rest_of_secret"
        # keep the human-identifiable head, never the full secret
        p = api_token.token_prefix(tok)
        assert p.startswith("s3bear_pat_")
        assert len(p) <= len("s3bear_pat_") + 8
        assert p in tok


class TestShouldUpdateLastUsed:
    def test_true_when_never_used(self):
        assert api_token.should_update_last_used(None) is True

    def test_false_when_recently_used(self):
        now = datetime.now(timezone.utc)
        assert api_token.should_update_last_used(now - timedelta(seconds=10)) is False

    def test_true_when_stale(self):
        now = datetime.now(timezone.utc)
        assert api_token.should_update_last_used(now - timedelta(minutes=10)) is True

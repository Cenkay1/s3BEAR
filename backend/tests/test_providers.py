"""Unit tests for multi-provider routing in the s3 service.

These exercise the in-memory registry (providers, default, bucket→provider map)
and the config-resolution logic that decides which backend an operation targets.
No network or real S3 is involved.
"""
import pytest

from app.services import s3 as s3_service


def _provider(pid: str, name: str, endpoint: str = "") -> dict:
    return {
        "id": pid, "name": name,
        "access_key": f"ak-{pid}", "secret_key": f"sk-{pid}",
        "region": "us-east-1", "endpoint": endpoint, "presigned_base": "", "use_ssl": True,
    }


@pytest.fixture(autouse=True)
def clean_registry():
    """Reset the registry before and after each test so state never leaks."""
    s3_service.set_providers([], None)
    s3_service.set_bucket_map({})
    yield
    s3_service.set_providers([], None)
    s3_service.set_bucket_map({})


class TestProviderRegistry:
    def test_no_providers_falls_back_to_env(self):
        cfg = s3_service._resolve_cfg(bucket="anything")
        assert cfg["id"] == s3_service.ENV_PROVIDER_ID

    def test_first_provider_becomes_default(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")])
        assert s3_service._default_provider_id == "a"
        # An unmapped bucket resolves to the default provider.
        assert s3_service._resolve_cfg(bucket="unmapped")["id"] == "a"

    def test_explicit_default_is_honored(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="b")
        assert s3_service._resolve_cfg(bucket="unmapped")["id"] == "b"

    def test_bucket_routes_to_mapped_provider(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="a")
        s3_service.set_bucket_map({"photos": "b"})
        assert s3_service._resolve_cfg(bucket="photos")["id"] == "b"
        assert s3_service._resolve_cfg(bucket="other")["id"] == "a"

    def test_explicit_provider_id_wins_over_bucket_map(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="a")
        s3_service.set_bucket_map({"photos": "b"})
        assert s3_service._resolve_cfg(bucket="photos", provider_id="a")["id"] == "a"

    def test_register_and_unregister_bucket(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="a")
        s3_service.register_bucket("docs", "b")
        assert s3_service._resolve_cfg(bucket="docs")["id"] == "b"
        s3_service.unregister_bucket("docs")
        # Falls back to the default once the mapping is gone.
        assert s3_service._resolve_cfg(bucket="docs")["id"] == "a"

    def test_stale_mapping_to_missing_provider_falls_back_to_default(self):
        s3_service.set_providers([_provider("a", "A")], default_id="a")
        s3_service.set_bucket_map({"orphan": "deleted-provider-id"})
        assert s3_service._resolve_cfg(bucket="orphan")["id"] == "a"


class TestSameProvider:
    def test_same_provider_true_for_same_backend(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="a")
        s3_service.set_bucket_map({"x": "a", "y": "a"})
        assert s3_service._same_provider("x", "y") is True

    def test_same_provider_false_across_backends(self):
        s3_service.set_providers([_provider("a", "A"), _provider("b", "B")], default_id="a")
        s3_service.set_bucket_map({"x": "a", "y": "b"})
        assert s3_service._same_provider("x", "y") is False


class TestNormalizeCfg:
    def test_accepts_api_shaped_keys(self):
        cfg = s3_service.normalize_cfg({
            "access_key_id": "AK", "secret_access_key": "SK",
            "region": "eu-west-1", "endpoint_url": "http://minio:9000",
        })
        assert cfg["access_key"] == "AK"
        assert cfg["secret_key"] == "SK"
        assert cfg["region"] == "eu-west-1"
        assert cfg["endpoint"] == "http://minio:9000"

    def test_defaults_region_when_missing(self):
        cfg = s3_service.normalize_cfg({"access_key": "AK", "secret_key": "SK"})
        assert cfg["region"] == "us-east-1"


class TestClientTargeting:
    def test_make_client_uses_bucket_provider_endpoint(self):
        s3_service.set_providers([
            _provider("a", "A", endpoint="http://minio:9000"),
            _provider("b", "B", endpoint="http://minio2:9000"),
        ], default_id="a")
        s3_service.set_bucket_map({"onA": "a", "onB": "b"})

        client_a = s3_service._make_client(bucket="onA")
        client_b = s3_service._make_client(bucket="onB")
        assert client_a.meta.endpoint_url == "http://minio:9000"
        assert client_b.meta.endpoint_url == "http://minio2:9000"

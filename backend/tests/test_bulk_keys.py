"""Unit tests for destination-key construction used by bulk copy/move."""
import pytest

from app.services import s3 as s3_service


class TestBuildDestKey:
    def test_no_prefix_keeps_basename(self):
        assert s3_service.build_dest_key("a/b/c.png", "") == "c.png"

    def test_prefix_gets_trailing_slash(self):
        assert s3_service.build_dest_key("a/b/c.png", "dest") == "dest/c.png"

    def test_prefix_with_trailing_slash_unchanged(self):
        assert s3_service.build_dest_key("a/b/c.png", "dest/") == "dest/c.png"

    def test_nested_prefix(self):
        assert s3_service.build_dest_key("x.txt", "2026/aug/") == "2026/aug/x.txt"

    def test_root_level_source(self):
        assert s3_service.build_dest_key("file.bin", "archive/") == "archive/file.bin"

    def test_trailing_slash_source_stripped(self):
        # a "folder-like" key should still yield its last segment
        assert s3_service.build_dest_key("a/b/", "dest/") == "dest/b"

    def test_empty_key_raises(self):
        with pytest.raises(ValueError):
            s3_service.build_dest_key("", "dest/")

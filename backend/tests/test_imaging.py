"""Unit tests for app.services.imaging — transform param parsing and the
Pillow-backed transform. Runs fully offline (no S3/DB)."""
import io

import pytest
from PIL import Image

from app.services import imaging


def _png_bytes(w=200, h=100, color=(255, 0, 0), mode="RGB"):
    img = Image.new(mode, (w, h), color if mode != "RGBA" else color + (255,))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestParseTransformParams:
    def test_no_params_returns_none(self):
        assert imaging.parse_transform_params() is None
        assert imaging.parse_transform_params(None, None, None, None, None) is None

    def test_width_only(self):
        spec = imaging.parse_transform_params(w=512)
        assert spec is not None
        assert spec.width == 512 and spec.height is None

    def test_format_normalized(self):
        assert imaging.parse_transform_params(fmt="JPG").fmt == "jpeg"
        assert imaging.parse_transform_params(fmt="WEBP").fmt == "webp"

    def test_default_fit_is_contain(self):
        assert imaging.parse_transform_params(w=10, h=10).fit == "contain"

    def test_cover_fit(self):
        assert imaging.parse_transform_params(w=10, h=10, fit="cover").fit == "cover"

    def test_quality_only_is_a_transform(self):
        assert imaging.parse_transform_params(q=70) is not None

    @pytest.mark.parametrize("kwargs", [
        {"w": 0}, {"h": -5}, {"w": 100000},
        {"q": 0}, {"q": 101},
        {"fmt": "gif"}, {"fmt": "bmp"},
        {"w": 10, "h": 10, "fit": "squish"},
    ])
    def test_invalid_raises(self, kwargs):
        with pytest.raises(ValueError):
            imaging.parse_transform_params(**kwargs)


class TestTransformImage:
    def test_resize_width_preserves_aspect(self):
        data = _png_bytes(200, 100)
        spec = imaging.parse_transform_params(w=100)
        out, ctype = imaging.transform_image(data, spec)
        img = Image.open(io.BytesIO(out))
        assert img.size == (100, 50)  # aspect preserved
        assert ctype == "image/png"

    def test_format_conversion_to_webp(self):
        data = _png_bytes(50, 50)
        spec = imaging.parse_transform_params(fmt="webp")
        out, ctype = imaging.transform_image(data, spec)
        assert ctype == "image/webp"
        assert Image.open(io.BytesIO(out)).format == "WEBP"

    def test_contain_fits_within_box(self):
        data = _png_bytes(200, 100)
        spec = imaging.parse_transform_params(w=50, h=50, fit="contain")
        out, _ = imaging.transform_image(data, spec)
        img = Image.open(io.BytesIO(out))
        assert img.size == (50, 25)  # fits inside 50x50, aspect kept

    def test_cover_fills_and_crops(self):
        data = _png_bytes(200, 100)
        spec = imaging.parse_transform_params(w=50, h=50, fit="cover")
        out, _ = imaging.transform_image(data, spec)
        img = Image.open(io.BytesIO(out))
        assert img.size == (50, 50)  # exact box, cropped

    def test_rgba_to_jpeg_drops_alpha(self):
        data = _png_bytes(40, 40, mode="RGBA")
        spec = imaging.parse_transform_params(fmt="jpeg")
        out, ctype = imaging.transform_image(data, spec)
        assert ctype == "image/jpeg"
        assert Image.open(io.BytesIO(out)).mode == "RGB"

    def test_unopenable_data_raises(self):
        with pytest.raises(imaging.UnsupportedImage):
            imaging.transform_image(b"not an image", imaging.parse_transform_params(w=10))

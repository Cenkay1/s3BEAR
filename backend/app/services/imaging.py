"""On-the-fly image transformation (resize / re-format / re-quality).

Pure helpers only — no S3 or DB. `parse_transform_params` validates query
input into a TransformSpec (or None when no transform is requested);
`transform_image` applies it with Pillow.
"""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

MAX_DIMENSION = 10000
_ALLOWED_FORMATS = {"webp": "WEBP", "jpeg": "JPEG", "jpg": "JPEG", "png": "PNG"}
_ALLOWED_FITS = {"contain", "cover"}
_CONTENT_TYPES = {"WEBP": "image/webp", "JPEG": "image/jpeg", "PNG": "image/png"}
_QUALITY_FORMATS = {"WEBP", "JPEG"}


class UnsupportedImage(Exception):
    """Raised when the source bytes are not a Pillow-decodable image."""


@dataclass(frozen=True)
class TransformSpec:
    width: int | None = None
    height: int | None = None
    fmt: str | None = None  # normalized: "webp" | "jpeg" | "png"
    quality: int | None = None
    fit: str = "contain"


def _validate_dimension(value: int | None, name: str) -> int | None:
    if value is None:
        return None
    if not (1 <= value <= MAX_DIMENSION):
        raise ValueError(f"{name} must be between 1 and {MAX_DIMENSION}")
    return value


def parse_transform_params(
    w: int | None = None,
    h: int | None = None,
    fmt: str | None = None,
    q: int | None = None,
    fit: str | None = None,
) -> TransformSpec | None:
    """Validate raw query params into a TransformSpec. Returns None when no
    transform is requested (no w/h/fmt/q). Raises ValueError on bad input."""
    if w is None and h is None and fmt is None and q is None:
        return None

    width = _validate_dimension(w, "w")
    height = _validate_dimension(h, "h")

    normalized_fmt = None
    if fmt is not None:
        key = fmt.strip().lower()
        if key not in _ALLOWED_FORMATS:
            raise ValueError(f"Unsupported format: {fmt!r}")
        normalized_fmt = "jpeg" if key in ("jpg", "jpeg") else key

    if q is not None and not (1 <= q <= 100):
        raise ValueError("q (quality) must be between 1 and 100")

    fit_value = (fit or "contain").strip().lower()
    if fit_value not in _ALLOWED_FITS:
        raise ValueError(f"fit must be one of {sorted(_ALLOWED_FITS)}")

    return TransformSpec(width=width, height=height, fmt=normalized_fmt, quality=q, fit=fit_value)


def _resize(img: "Image.Image", w: int | None, h: int | None, fit: str) -> "Image.Image":
    ow, oh = img.size
    if w and h:
        if fit == "cover":
            scale = max(w / ow, h / oh)
            nw, nh = max(1, round(ow * scale)), max(1, round(oh * scale))
            img = img.resize((nw, nh), Image.LANCZOS)
            left, top = (nw - w) // 2, (nh - h) // 2
            return img.crop((left, top, left + w, top + h))
        scale = min(w / ow, h / oh)  # contain
    elif w:
        scale = w / ow
    else:
        scale = h / oh
    return img.resize((max(1, round(ow * scale)), max(1, round(oh * scale))), Image.LANCZOS)


def transform_image(data: bytes, spec: TransformSpec) -> tuple[bytes, str]:
    """Apply the transform, returning (bytes, content_type). Raises
    UnsupportedImage if the source can't be decoded."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise UnsupportedImage(str(e))

    orig_format = (img.format or "PNG").upper()
    target = _ALLOWED_FORMATS.get((spec.fmt or "").lower(), orig_format)
    if target not in _CONTENT_TYPES:
        target = "PNG"  # fall back to a lossless format we can always write

    if spec.width or spec.height:
        img = _resize(img, spec.width, spec.height, spec.fit)

    if target == "JPEG" and img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")

    save_kwargs: dict = {}
    if spec.quality is not None and target in _QUALITY_FORMATS:
        save_kwargs["quality"] = spec.quality

    buf = io.BytesIO()
    img.save(buf, format=target, **save_kwargs)
    return buf.getvalue(), _CONTENT_TYPES[target]

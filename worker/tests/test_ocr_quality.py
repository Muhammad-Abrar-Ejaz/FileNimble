import io

import pytest
from pypdf import PdfReader, PdfWriter

from ocr_fixtures import png, scanned_pdf
from qualify_office import qualify


@pytest.mark.parametrize("variant", ["clear", "rotated", "low", "noise", "skewed"])
def test_english_image_ground_truth(variant):
    text = qualify("512m", "image-to-text", png(variant), "ocr").decode("utf-8-sig")
    assert "4827" in text and "125" in text
    assert "quick brown fox" in text.lower()


def test_blank_does_not_invent_text():
    text = qualify("512m", "image-to-text", png("blank"), "ocr").decode("utf-8-sig")
    assert not text.strip()


def test_pdf_text_and_searchable_page_order():
    source = scanned_pdf()
    assert not any(page.extract_text().strip() for page in PdfReader(io.BytesIO(source)).pages)
    text = qualify("512m", "pdf-to-text", source, "ocr", expected_pages=2).decode("utf-8-sig")
    assert text.index("FIRST PAGE ALPHA") < text.index("SECOND PAGE BETA")
    output = qualify("512m", "ocr-pdf", source, "ocr", expected_pages=2)
    reader = PdfReader(io.BytesIO(output), strict=True)
    assert len(reader.pages) == 2
    for page, marker in zip(reader.pages, ["FIRST PAGE ALPHA", "SECOND PAGE BETA"], strict=True):
        assert marker in page.extract_text()
        assert page.images


def test_unsupported_language_and_malformed_image():
    qualify(
        "512m",
        "image-to-text",
        png(),
        "ocr",
        expect_error=True,
        options={"language": "fra", "cleanup": True},
    )
    qualify("512m", "image-to-text", b"\x89PNG\r\n\x1a\nbroken", "ocr", expect_error=True)


def test_encryption_and_page_limit_rejected():
    for encrypted in [False, True]:
        writer = PdfWriter()
        for _ in range(6 if not encrypted else 1):
            writer.add_blank_page(600, 800)
        if encrypted:
            writer.encrypt("project-owned-password")
        output = io.BytesIO()
        writer.write(output)
        writer.close()
        qualify("512m", "ocr-pdf", output.getvalue(), "ocr", expect_error=True)


def test_oversized_image_and_malformed_pdf():
    from PIL import Image

    image = Image.new("L", (2100, 2000), 255)
    output = io.BytesIO()
    image.save(output, format="PNG")
    image.close()
    qualify("512m", "image-to-text", output.getvalue(), "ocr", expect_error=True)
    qualify("512m", "ocr-pdf", b"%PDF-1.7\nbroken", "ocr", expect_error=True)


def test_jpeg_without_cleanup():
    from PIL import Image

    with Image.open(io.BytesIO(png())) as image:
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=90)
    text = qualify(
        "512m",
        "image-to-text",
        output.getvalue(),
        "ocr",
        options={"language": "eng", "cleanup": False},
    ).decode("utf-8-sig")
    assert "4827" in text and "125" in text


def test_transparent_png_text_stays_visible():
    from PIL import Image

    with Image.open(io.BytesIO(png())) as original:
        image = original.convert("RGBA")
        mask = original.convert("L").point(lambda value: 255 - value)
        image.putalpha(mask)
        output = io.BytesIO()
        image.save(output, format="PNG")
        image.close()
        mask.close()
    text = qualify("512m", "image-to-text", output.getvalue(), "ocr").decode("utf-8-sig")
    assert "4827" in text

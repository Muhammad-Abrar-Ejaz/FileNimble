"""Bounded local English OCR. No network, cloud API, shell, or persistent content."""

import io
import re
import subprocess
import warnings
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps
from pypdf import PdfReader, PdfWriter

from validation import validate_pdf, validate_pdf_input

TOOLS = {"image-to-text", "pdf-to-text", "ocr-pdf"}
MAX_PIXELS = 4_000_000
MAX_TOTAL_PIXELS = 16_000_000
MAX_PAGES = 5
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)


def run(arguments, timeout=20):
    return subprocess.run(  # noqa: S603 -- fixed executable, enum options and generated paths.
        ["/usr/bin/tesseract", *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        timeout=timeout,
        check=False,
    )


def checked_image(data):
    if not (data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff")):
        raise ValueError("CORRUPT_FILE")
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in {"PNG", "JPEG"} or getattr(image, "n_frames", 1) != 1:
            raise ValueError("UNSUPPORTED_FORMAT")
        check_dimensions(*image.size)
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        with ImageOps.exif_transpose(image) as oriented:
            with oriented.convert("RGBA") as rgba:
                with Image.new("RGBA", rgba.size, "white") as background:
                    background.alpha_composite(rgba)
                    return background.convert("RGB")


def check_dimensions(width, height):
    if not 16 <= width <= 6000 or not 16 <= height <= 6000 or width * height > MAX_PIXELS:
        raise ValueError("RESOURCE_LIMIT")


def prepare(image, cleanup):
    if not cleanup:
        return image.copy()
    result = ImageOps.autocontrast(image.convert("L")).filter(ImageFilter.MedianFilter(3))
    probe = Path("/work/orientation.png")
    result.save(probe)
    detected = run([str(probe), "stdout", "--psm", "0", "-l", "osd"], timeout=10)
    match = re.search(rb"Rotate: (90|180|270)\b", detected.stdout)
    if detected.returncode == 0 and match:
        rotated = result.rotate(-int(match[1]), expand=True, fillcolor=255)
        result.close()
        result = rotated
    probe.unlink(missing_ok=True)
    # Small-angle deskew: maximize horizontal ink concentration on a bounded sample.
    sample = result.copy()
    sample.thumbnail((700, 700))
    sample = sample.point(lambda pixel: 0 if pixel < 160 else 255)

    def score(angle):
        rotated = sample.rotate(angle, expand=False, fillcolor=255)
        values = list(rotated.getdata())
        width = rotated.width
        total = sum(
            sum(255 - pixel for pixel in values[row : row + width]) ** 2
            for row in range(0, len(values), width)
        )
        rotated.close()
        return total

    baseline = score(0)
    best = max((score(step / 2), step / 2) for step in range(-10, 11))
    sample.close()
    if best[1] and baseline and best[0] > baseline * 1.05:
        rotated = result.rotate(
            best[1], resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255
        )
        result.close()
        result = rotated
    return result


def page_images(data, tool):
    if tool == "image-to-text":
        yield checked_image(data)
        return
    import pypdfium2 as pdfium

    source = Path("/work/source.pdf")
    source.write_bytes(data)
    pages = validate_pdf_input(source, max_image_pixels=16_000_000)
    if pages > MAX_PAGES:
        raise ValueError("RESOURCE_LIMIT")
    total = 0
    with pdfium.PdfDocument(source) as document:
        for index in range(pages):
            page = document[index]
            try:
                width, height = page.get_size()
                check_dimensions(int(width * 2 + 1), int(height * 2 + 1))
                total += int(width * 2 + 1) * int(height * 2 + 1)
                if total > MAX_TOTAL_PIXELS:
                    raise ValueError("RESOURCE_LIMIT")
                bitmap = page.render(scale=2, draw_annots=False)
                try:
                    yield bitmap.to_pil().convert("RGB")
                finally:
                    bitmap.close()
            finally:
                page.close()


def convert(data, tool, options):
    if len(data) > 10 * 1024 * 1024 or tool not in TOOLS:
        raise ValueError("RESOURCE_LIMIT")
    if (
        set(options) - {"language", "cleanup"}
        or options.get("language", "eng") != "eng"
        or type(options.get("cleanup", True)) is not bool
    ):
        raise ValueError("INVALID_REQUEST")
    writer = PdfWriter()
    texts = []
    pages = 0
    try:
        for index, original in enumerate(page_images(data, tool)):
            try:
                image = prepare(original, options.get("cleanup", True))
                try:
                    path = Path(f"/work/page-{index}.png")
                    image.save(path, dpi=(144, 144))
                    base = f"/work/ocr-{index}"
                    arguments = [
                        str(path),
                        base,
                        "-l",
                        "eng",
                        "--oem",
                        "1",
                        "--psm",
                        "3",
                        "--dpi",
                        "144",
                        "txt",
                    ]
                    if tool == "ocr-pdf":
                        arguments.append("pdf")
                    completed = run(arguments)
                    if completed.returncode != 0:
                        raise ValueError("CONVERSION_FAILED")
                    text_path = Path(base + ".txt")
                    if text_path.stat().st_size > 1024 * 1024:
                        raise ValueError("RESOURCE_LIMIT")
                    text = text_path.read_text(encoding="utf-8")
                    texts.append(text)
                    if tool == "ocr-pdf":
                        pdf = Path(base + ".pdf")
                        if validate_pdf(pdf) != 1:
                            raise ValueError("INVALID_OUTPUT")
                        reader = PdfReader(pdf, strict=True)
                        # Nonblank OCR must really be represented in the searchable layer.
                        if text.strip() and not reader.pages[0].extract_text().strip():
                            raise ValueError("INVALID_OUTPUT")
                        writer.add_page(reader.pages[0])
                        pdf.unlink()
                    text_path.unlink()
                    path.unlink()
                    pages += 1
                finally:
                    image.close()
            finally:
                original.close()
        if tool == "ocr-pdf":
            output = Path("/work/result.pdf")
            writer.write(output)
            if validate_pdf(output) != pages:
                raise ValueError("INVALID_OUTPUT")
            media_type = "application/pdf"
        else:
            output = Path("/work/result.txt")
            # UTF-8 BOM allows a valid, nonempty blank-page result without inventing text.
            output.write_text("\f\n".join(texts), encoding="utf-8-sig")
            if output.stat().st_size > 5 * 1024 * 1024:
                raise ValueError("RESOURCE_LIMIT")
            output.read_text(encoding="utf-8-sig")
            media_type = "text/plain; charset=utf-8"
        return output, {"pages": pages, "mediaType": media_type}
    finally:
        writer.close()

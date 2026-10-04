"""Deterministic, project-owned scan fixtures with known ground truth."""

import io
import random

from PIL import Image, ImageDraw, ImageFont

LINES = [
    "FileNimble document recognition test",
    "The quick brown fox jumps over the lazy dog.",
    "Invoice number 4827. Total amount 125 dollars.",
    "Please review every result before sharing.",
    "Clear printed English text is supported.",
    "This page belongs to a generated test document.",
    "Page order and searchable words are verified.",
    "No private documents are used in these tests.",
]


def image(variant="clear", label="FIRST PAGE ALPHA"):
    canvas = Image.new("RGB", (1600, 1000), (235, 235, 235) if variant == "low" else "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=38)
    if variant != "blank":
        for index, line in enumerate([label, *LINES]):
            draw.text(
                (65, 60 + index * 90),
                line,
                font=font,
                fill=(180, 180, 180) if variant == "low" else "black",
            )
    if variant == "noise":
        randomizer = random.Random(31)
        for _ in range(1500):
            x, y = randomizer.randrange(1600), randomizer.randrange(1000)
            draw.point((x, y), fill="black")
    if variant == "rotated":
        canvas = canvas.rotate(90, expand=True, fillcolor="white")
    if variant == "skewed":
        canvas = canvas.rotate(3, expand=False, fillcolor="white")
    return canvas


def png(variant="clear"):
    with image(variant) as canvas:
        output = io.BytesIO()
        canvas.save(output, format="PNG")
        return output.getvalue()


def scanned_pdf():
    first, second = image(), image(label="SECOND PAGE BETA")
    try:
        output = io.BytesIO()
        first.save(output, format="PDF", save_all=True, append_images=[second], resolution=144)
        return output.getvalue()
    finally:
        first.close()
        second.close()

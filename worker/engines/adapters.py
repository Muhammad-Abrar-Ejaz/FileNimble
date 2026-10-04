"""Small native adapters. Called only inside an isolated conversion container."""

import subprocess
from pathlib import Path

from validation import validate_pdf, validate_pdf_input


def html(data):
    from weasyprint import HTML

    if len(data) > 2 * 1024 * 1024:
        raise ValueError("RESOURCE_LIMIT")
    text = bytes(data).decode("utf-8-sig")
    blocked = []

    def reject_resource(url, *args, **kwargs):
        blocked.append(True)
        raise ValueError("External resources are disabled")

    output = Path("/work/output.pdf")
    document = HTML(string=text, url_fetcher=reject_resource).render()
    if blocked or not 1 <= len(document.pages) <= 100:
        raise ValueError("UNSUPPORTED_FORMAT")
    document.write_pdf(output)
    if blocked:
        raise ValueError("UNSUPPORTED_FORMAT")
    return output, {"pages": validate_pdf(output), "mediaType": "application/pdf"}


def utility(data, tool):
    source, output = Path("/work/input.pdf"), Path("/work/output.pdf")
    source.write_bytes(data)
    if tool == "compress-pdf":
        validate_pdf_input(source)
        args = [
            "--object-streams=generate",
            "--compress-streams=y",
            "--recompress-flate",
            "--compression-level=9",
        ]
    elif tool == "repair-pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("CORRUPT_FILE")
        args = []
    else:
        raise ValueError("UNSUPPORTED_FORMAT")
    result = subprocess.run(  # noqa: S603 -- fixed executable/arguments and generated sandbox paths.
        ["/usr/bin/qpdf", *args, str(source), str(output)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=30,
        check=False,
    )  # noqa: S603 -- fixed command and generated paths.
    if result.returncode not in (0, 3):
        raise ValueError("CONVERSION_FAILED")
    pages = validate_pdf_input(output)
    return output, {"pages": pages, "mediaType": "application/pdf"}

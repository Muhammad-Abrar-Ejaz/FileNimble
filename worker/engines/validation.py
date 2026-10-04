"""Bounded document checks executed only inside the disposable sandbox."""

import io
import subprocess
import zipfile
from pathlib import PurePosixPath
from defusedxml import ElementTree
from pypdf import PdfReader

MAX_INPUT = 25 * 1024 * 1024
MAX_OUTPUT = 100 * 1024 * 1024
MAX_EXPANDED = 100 * 1024 * 1024


def validate_office(data, extension):
    expected = {
        "docx": "word/document.xml",
        "pptx": "ppt/presentation.xml",
        "xlsx": "xl/workbook.xml",
    }[extension]
    if not data.startswith(b"PK\x03\x04"):
        raise ValueError("CORRUPT_FILE")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 2000 or sum(item.file_size for item in entries) > MAX_EXPANDED:
            raise ValueError("RESOURCE_LIMIT")
        names = [item.filename for item in entries]
        if (
            expected not in names
            or "[Content_Types].xml" not in names
            or len(set(names)) != len(names)
        ):
            raise ValueError("CORRUPT_FILE")
        for item in entries:
            path = PurePosixPath(item.filename)
            name = item.filename.lower()
            if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                raise ValueError("UNSUPPORTED_FORMAT")
            if item.flag_bits & 1 or (item.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("UNSUPPORTED_FORMAT")
            if any(
                part in name
                for part in (
                    "vbaproject",
                    "embeddings/",
                    "externallinks/",
                    "activex/",
                    "_xmlsignatures/",
                )
            ):
                raise ValueError("UNSUPPORTED_FORMAT")
            if (
                item.file_size > 20 * 1024 * 1024
                or item.file_size > max(1, item.compress_size) * 200
            ):
                raise ValueError("RESOURCE_LIMIT")
            if name.endswith((".xml", ".rels")):
                content = archive.read(item)
                # Limit this first adapter to UTF-8 XML. This also prevents alternate
                # encodings from hiding forbidden declarations from the preflight.
                text = content.decode("utf-8-sig")
                if "\x00" in text or "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
                    raise ValueError("UNSUPPORTED_FORMAT")
                root = ElementTree.fromstring(text)
                for element in root.iter():
                    if element.attrib.get("TargetMode", "").lower() == "external":
                        raise ValueError("UNSUPPORTED_FORMAT")
                    if any("macroenabled" in value.lower() for value in element.attrib.values()):
                        raise ValueError("UNSUPPORTED_FORMAT")


def validate_pdf(path):
    size = path.stat().st_size
    if not 0 < size <= MAX_OUTPUT:
        raise ValueError("RESOURCE_LIMIT")
    with path.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            raise ValueError("INVALID_OUTPUT")
    checked = subprocess.run(  # noqa: S603 -- fixed executable/arguments and generated sandbox paths.
        ["/usr/bin/qpdf", "--check", str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=15,
        check=False,
    )  # noqa: S603 -- fixed executable and generated sandbox paths; no shell.
    if checked.returncode != 0:
        raise ValueError("INVALID_OUTPUT")
    result = subprocess.run(  # noqa: S603 -- fixed executable/arguments and generated sandbox paths.
        ["/usr/bin/qpdf", "--show-npages", str(path)], capture_output=True, timeout=15, check=True
    )  # noqa: S603 -- fixed executable and generated sandbox paths; no shell.
    pages = int(result.stdout)
    if not 1 <= pages <= 200:
        raise ValueError("RESOURCE_LIMIT")
    reader = PdfReader(path, strict=True)
    if reader.is_encrypted or len(reader.pages) != pages:
        raise ValueError("INVALID_OUTPUT")
    for page in reader.pages:
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        if not 1 <= width <= 14400 or not 1 <= height <= 14400:
            raise ValueError("RESOURCE_LIMIT")
    return pages


def validate_pdf_input(path, max_image_pixels=None):
    pages = validate_pdf(path)
    reader = PdfReader(path, strict=True)
    forbidden = {
        "/JavaScript",
        "/JS",
        "/Launch",
        "/EmbeddedFiles",
        "/AcroForm",
        "/XFA",
        "/AA",
        "/OpenAction",
        "/Collection",
        "/RichMedia",
        "/GoToR",
        "/SubmitForm",
        "/ImportData",
    }
    seen = set()
    pending = [reader.trailer]
    count = 0
    while pending:
        count += 1
        if count > 100000:
            raise ValueError("RESOURCE_LIMIT")
        value = pending.pop()
        identity = id(value)
        if identity in seen:
            continue
        seen.add(identity)
        if hasattr(value, "get_object"):
            resolved = value.get_object()
            if resolved is not value:
                pending.append(resolved)
                continue
        if isinstance(value, dict):
            if max_image_pixels is not None and value.get("/Subtype") == "/Image":
                width, height = value.get("/Width", 0), value.get("/Height", 0)
                if (
                    not isinstance(width, int)
                    or not isinstance(height, int)
                    or width <= 0
                    or height <= 0
                    or width * height > max_image_pixels
                ):
                    raise ValueError("RESOURCE_LIMIT")
            if forbidden.intersection(value.keys()) or str(value.get("/S", "")) in forbidden:
                raise ValueError("UNSUPPORTED_FORMAT")
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)
    return pages

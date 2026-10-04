"""Project-owned OOXML fixtures; no uploaded or third-party documents."""

import io
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "engines"))
from validation import validate_office  # noqa: E402


def package(extra=None):
    output = io.BytesIO()
    entries = {
        "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>FileNimble owned fixture — café</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>',
    }
    entries.update(extra or {})
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return output.getvalue()


def test_owned_docx_structure():
    validate_office(package(), "docx")


@pytest.mark.parametrize(
    "extra",
    [
        {"../outside.xml": "<x/>"},
        {"/outside.xml": "<x/>"},
        {"word/vbaProject.bin": b"macro"},
        {"word/embeddings/payload.zip": b"PK"},
        {"word/activeX/item.xml": "<x/>"},
        {"word/externalLinks/link.xml": "<x/>"},
        {"word/bomb.xml": "<!DOCTYPE x [<!ENTITY a 'boom'>]><x>&a;</x>"},
        {"word/utf16.xml": "<!DOCTYPE x><x/>".encode("utf-16")},
        {
            "word/_rels/document.xml.rels": '<Relationships><Relationship TargetMode="External" Target="file:///etc/passwd"/></Relationships>'
        },
        {"word/big.xml": "a" * (21 * 1024 * 1024)},
    ],
)
def test_hostile_office_rejected(extra):
    with pytest.raises((ValueError, UnicodeError)):
        validate_office(package(extra), "docx")


@pytest.mark.parametrize("data", [b"", b"not zip", b"PK\x03\x04broken"])
def test_malformed_office_rejected(data):
    with pytest.raises((ValueError, zipfile.BadZipFile)):
        validate_office(data, "docx")


def test_capabilities_are_closed_until_qualified():
    from app.capabilities import CAPABILITIES, get_capability

    phase6 = {
        slug: capability
        for slug, capability in CAPABILITIES.items()
        if 100 <= int(capability.task[3:]) <= 111
    }
    assert len(phase6) == 12
    for slug in phase6:
        with pytest.raises(ValueError, match="UNSUPPORTED_FORMAT"):
            get_capability(slug)
    with pytest.raises(ValueError):
        get_capability("arbitrary-command", require_enabled=False)

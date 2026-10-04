"""Server policy, independent of public registry claims.

Native capabilities remain disabled until their individual release gates pass.
Never accept executable names, image names, or resource settings from a client.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Capability:
    task: str
    extension: str
    media_type: str
    family: str
    output_extension: str = "pdf"
    enabled: bool = False


CAPABILITIES = {
    "image-to-text": Capability("FN-120", "png", "image/png", "ocr", "txt", enabled=True),
    "pdf-to-text": Capability("FN-121", "pdf", "application/pdf", "ocr", "txt", enabled=True),
    "ocr-pdf": Capability("FN-122", "pdf", "application/pdf", "ocr", enabled=True),
    "word-to-pdf": Capability(
        "FN-100",
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "office",
    ),
    "powerpoint-to-pdf": Capability(
        "FN-101",
        "pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "office",
    ),
    "excel-to-pdf": Capability(
        "FN-102",
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "office",
    ),
    "html-to-pdf": Capability("FN-103", "html", "text/html", "html"),
    "pdf-to-word": Capability("FN-104", "pdf", "application/pdf", "reconstruction", "docx"),
    "pdf-to-powerpoint": Capability("FN-105", "pdf", "application/pdf", "render", "pptx"),
    "pdf-to-excel": Capability("FN-106", "pdf", "application/pdf", "tables", "xlsx"),
    "compress-pdf": Capability("FN-107", "pdf", "application/pdf", "utility"),
    "protect-pdf": Capability("FN-108", "pdf", "application/pdf", "secret"),
    "unlock-pdf": Capability("FN-109", "pdf", "application/pdf", "secret"),
    "pdf-to-pdfa": Capability("FN-110", "pdf", "application/pdf", "archival"),
    "repair-pdf": Capability("FN-111", "pdf", "application/pdf", "utility"),
    "csv-to-xlsx": Capability("FN-131", "csv", "text/csv", "extraction", "xlsx", enabled=True),
    "xlsx-to-csv": Capability(
        "FN-131",
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "extraction",
        "csv",
        enabled=True,
    ),
    "json-to-xlsx": Capability(
        "FN-134", "json", "application/json", "extraction", "xlsx", enabled=True
    ),
    "xlsx-to-json": Capability(
        "FN-134",
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "extraction",
        "json",
        enabled=True,
    ),
    "markdown-to-pdf": Capability("FN-136", "md", "text/markdown", "html", "pdf", enabled=True),
    "markdown-to-docx": Capability(
        "FN-137", "md", "text/markdown", "extraction", "docx", enabled=True
    ),
    "docx-to-markdown": Capability(
        "FN-138",
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "extraction",
        "md",
        enabled=True,
    ),
    "txt-to-pdf": Capability("FN-139", "txt", "text/plain", "html", "pdf", enabled=True),
    "rtf-to-pdf": Capability("FN-139", "rtf", "application/rtf", "office", "pdf", enabled=True),
}


CAPABILITIES.update(
    {
        "wav-to-flac": Capability("FN-171", "wav", "audio/wav", "media", "flac", enabled=True),
        "flac-to-wav": Capability("FN-171", "flac", "audio/flac", "media", "wav", enabled=True),
        # Implemented and qualified, but intentionally disabled until commercial
        # patent scope for the selected FFmpeg VP8 decoder is resolved.
        "video-mute": Capability("FN-172", "webm", "video/webm", "media", "webm"),
        "video-to-wav": Capability("FN-172", "webm", "video/webm", "media", "wav"),
        "video-to-frames": Capability("FN-172", "webm", "video/webm", "media", "zip"),
        "tar-to-zip": Capability(
            "FN-175", "tar", "application/x-tar", "archive", "zip", enabled=True
        ),
        "zip-to-tar": Capability(
            "FN-175", "zip", "application/zip", "archive", "tar", enabled=True
        ),
    }
)


def get_capability(slug: str, *, require_enabled: bool = True) -> Capability:
    capability = CAPABILITIES.get(slug)
    if capability is None or (require_enabled and not capability.enabled):
        raise ValueError("UNSUPPORTED_FORMAT")
    return capability

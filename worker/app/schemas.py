from typing import Literal

from phase11_policy import ARCHIVE_INPUT_LIMIT
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.capabilities import CAPABILITIES, get_capability


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class SourceFile(Strict):
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0, le=25 * 1024 * 1024)
    type: str = Field(max_length=150)

    @field_validator("name")
    @classmethod
    def safe_name(cls, value):
        if any(c in value for c in ("/", "\\", "..")) or any(ord(c) < 32 for c in value):
            raise ValueError("Unsafe filename")
        return value


class Options(Strict):
    language: Literal["eng"] = "eng"
    cleanup: bool = True
    behavior: Literal[
        "normal", "delay", "timeout", "memory", "probe", "invalid-output", "large-output"
    ] = "normal"


class CreateJob(Strict):
    tool: str = Field(min_length=1, max_length=80)
    files: list[SourceFile] = Field(min_length=1, max_length=1)
    options: Options = Field(default_factory=Options)

    @model_validator(mode="after")
    def capability_fields(self):
        source = self.files[0]
        if self.tool == "__fixture__":
            if self.options.model_fields_set - {"behavior"}:
                raise ValueError("Unsupported fixture options")
            if source.size > 1024 * 1024 or source.type != "application/octet-stream":
                raise ValueError("Unsupported fixture")
        elif self.tool in CAPABILITIES:
            capability = get_capability(self.tool, require_enabled=False)
            extension = source.name.lower().rsplit(".", 1)[-1]
            extensions = (
                {"png", "jpg", "jpeg"} if self.tool == "image-to-text" else {capability.extension}
            )
            if extension not in extensions:
                raise ValueError("Invalid extension")
            media_type = (
                "image/jpeg"
                if self.tool == "image-to-text" and extension in {"jpg", "jpeg"}
                else capability.media_type
            )
            aliases = {"audio/wav": "audio/x-wav", "audio/flac": "audio/x-flac"}
            if source.type not in (
                "",
                "application/octet-stream",
                media_type,
                aliases.get(media_type),
            ):
                raise ValueError("Invalid media type")
            if capability.family == "ocr":
                if source.size > 10 * 1024 * 1024 or self.options.model_fields_set - {
                    "language",
                    "cleanup",
                }:
                    raise ValueError("Unsupported OCR options or size")
            elif capability.family == "archive" and source.size > ARCHIVE_INPUT_LIMIT:
                raise ValueError("Archive input exceeds limit")
            elif self.options.model_fields_set:
                raise ValueError("Native options are not enabled")
        return self


class DownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fileId: UUID


State = Literal[
    "CREATED",
    "UPLOADING",
    "VALIDATING",
    "QUEUED",
    "PROCESSING",
    "COMPLETED",
    "EXPIRED",
    "FAILED",
    "CANCELLED",
]


class Transition(Strict):
    state: State


class Output(Strict):
    fileId: str
    bytes: int = Field(ge=0)
    mediaType: Literal[
        "audio/wav",
        "audio/flac",
        "video/webm",
        "application/zip",
        "application/x-tar",
        "application/octet-stream",
        "application/pdf",
        "text/plain; charset=utf-8",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]


class Upload(Strict):
    fileId: str
    method: Literal["PUT"] = "PUT"
    url: str
    headers: dict[str, str]


class Created(Strict):
    jobId: str
    state: State
    expiresAt: str
    uploads: list[Upload]


class Status(Strict):
    jobId: str
    state: State
    expiresAt: str
    progress: int | None = None
    error: str | None = None
    files: list[Output] = Field(default_factory=list)


class Download(Strict):
    url: str
    expiresIn: int

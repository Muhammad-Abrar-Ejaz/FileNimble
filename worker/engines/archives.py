"""Archive conversion without writing any uploaded member to the filesystem."""

import hashlib
import io
import re
import stat
import tarfile
import zipfile
from pathlib import Path

from phase11_policy import (
    ARCHIVE_INPUT_LIMIT,
    EXPANDED_LIMIT,
    MEMBER_COUNT,
    MEMBER_LIMIT,
    OUTPUT_LIMIT,
)


def safe_name(name):
    parts = name.rstrip("/").split("/")
    if not parts or len(parts) > 8 or len(name) > 180:
        raise ValueError("UNSAFE_ARCHIVE")
    for part in parts:
        if (
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{0,79}", part)
            or part.endswith((".", " "))
            or ".." in part
            or part.split(".")[0].upper()
            in {
                "CON",
                "PRN",
                "AUX",
                "NUL",
                *[f"COM{i}" for i in range(10)],
                *[f"LPT{i}" for i in range(10)],
            }
        ):
            raise ValueError("UNSAFE_ARCHIVE")
    return "/".join(parts)


def nested(name, data):
    return (
        name.lower().endswith((".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar"))
        or data.startswith(
            (
                b"PK\x03\x04",
                b"PK\x05\x06",
                b"\x1f\x8b",
                b"BZh",
                b"\xfd7zXZ",
                b"7z\xbc\xaf\x27\x1c",
                b"Rar!",
            )
        )
        or data[257:262] == b"ustar"
    )


def read_members(data, extension):
    if not 0 < len(data) <= OUTPUT_LIMIT:
        raise ValueError("RESOURCE_LIMIT")
    result, seen, total = [], set(), 0
    archive = (
        zipfile.ZipFile(io.BytesIO(data))
        if extension == "zip"
        else tarfile.open(fileobj=io.BytesIO(data), mode="r:")
    )
    with archive:
        members = archive.infolist() if extension == "zip" else archive
        for member in members:
            if len(result) >= MEMBER_COUNT:
                raise ValueError("RESOURCE_LIMIT")
            directory = member.is_dir() if extension == "zip" else member.isdir()
            name = safe_name(member.filename if extension == "zip" else member.name)
            if name.casefold() in seen:
                raise ValueError("UNSAFE_ARCHIVE")
            seen.add(name.casefold())
            size = member.file_size if extension == "zip" else member.size
            if (
                size < 0
                or size > MEMBER_LIMIT
                or total + size > EXPANDED_LIMIT
                or (directory and size)
            ):
                raise ValueError("RESOURCE_LIMIT")
            if extension == "zip":
                mode = stat.S_IFMT(member.external_attr >> 16)
                if (
                    member.flag_bits & 1
                    or mode not in (0, stat.S_IFREG, stat.S_IFDIR)
                    or member.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                ):
                    raise ValueError("UNSAFE_ARCHIVE")
                if size > max(1, member.compress_size) * 100:
                    raise ValueError("RESOURCE_LIMIT")
                stream = None if directory else archive.open(member)
            else:
                if member.pax_headers or not (directory or member.isfile()) or member.issparse():
                    raise ValueError("UNSAFE_ARCHIVE")
                stream = None if directory else archive.extractfile(member)
            content = b""
            if stream:
                with stream:
                    content = stream.read(MEMBER_LIMIT + 1)
                    if len(content) != size or stream.read(1):
                        raise ValueError("CORRUPT_FILE")
            if nested(name, content):
                raise ValueError("NESTED_ARCHIVE_UNSUPPORTED")
            total += len(content)
            result.append((name, directory, content))
    files = {name.casefold() for name, directory, _ in result if not directory}
    for name, _, _ in result:
        parts = name.casefold().split("/")
        if any("/".join(parts[:i]) in files for i in range(1, len(parts))):
            raise ValueError("UNSAFE_ARCHIVE")
    if not result or not files:
        raise ValueError("EMPTY_ARCHIVE")
    return result


def fingerprint(members):
    return [
        (name, directory, hashlib.sha256(data).hexdigest()) for name, directory, data in members
    ]


def convert(data, tool, work=Path("/work")):
    if len(data) > ARCHIVE_INPUT_LIMIT:
        raise ValueError("RESOURCE_LIMIT")
    source, target = ("tar", "zip") if tool == "tar-to-zip" else ("zip", "tar")
    members = read_members(data, source)
    output = work / ("result." + target)
    if target == "zip":
        # Stored ZIP avoids generating an archive that violates our own ratio limits.
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
            for name, directory, content in members:
                item = zipfile.ZipInfo(name + ("/" if directory else ""), (1980, 1, 1, 0, 0, 0))
                item.external_attr = (
                    (stat.S_IFDIR | 0o755) if directory else (stat.S_IFREG | 0o644)
                ) << 16
                archive.writestr(item, content)
    else:
        with tarfile.open(output, "w", format=tarfile.USTAR_FORMAT) as archive:
            for name, directory, content in members:
                item = tarfile.TarInfo(name)
                item.type = tarfile.DIRTYPE if directory else tarfile.REGTYPE
                item.mode = 0o755 if directory else 0o644
                item.size = len(content)
                archive.addfile(item, None if directory else io.BytesIO(content))
    expected = fingerprint(members)
    del members, content
    if (
        output.stat().st_size > OUTPUT_LIMIT
        or fingerprint(read_members(output.read_bytes(), target)) != expected
    ):
        raise ValueError("INVALID_OUTPUT")
    return output, {
        "pages": 1,
        "mediaType": "application/zip" if target == "zip" else "application/x-tar",
    }

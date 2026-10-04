import io
import stat
import sys
import tarfile
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "engines"))
from archives import convert, read_members, safe_name  # noqa: E402
from phase11_fixtures import archive  # noqa: E402
from phase11_policy import EXPANDED_LIMIT, MEMBER_LIMIT  # noqa: E402


@pytest.mark.parametrize("source,target", [("zip", "tar"), ("tar", "zip")])
def test_actual_archive_conversion_preserves_members(tmp_path, source, target):
    data = archive(source)
    output, metadata = convert(data, f"{source}-to-{target}", tmp_path)
    assert output.read_bytes() != data
    assert read_members(output.read_bytes(), target) == read_members(data, source)
    assert metadata["pages"] == 1
    if target == "tar":
        with tarfile.open(output) as result:
            for member in result:
                assert member.uid == member.gid == member.mtime == 0
                assert member.uname == member.gname == ""
    else:
        with zipfile.ZipFile(output) as result:
            assert all(item.date_time == (1980, 1, 1, 0, 0, 0) for item in result.infolist())


@pytest.mark.parametrize(
    "name",
    [
        "../escape",
        "/etc/passwd",
        "C:/private",
        "..\\escape",
        "folder/../../file",
        "//server/file",
        "a\x00b",
        "CON",
        "NUL.txt",
        "file:stream",
        "a/./b",
        "a/%2e%2e/b",
        "a./b",
        "a//b",
    ],
)
def test_traversal_names_rejected(name):
    with pytest.raises(ValueError):
        safe_name(name)


@pytest.mark.parametrize("extension", ["zip", "tar"])
@pytest.mark.parametrize(
    "entries",
    [
        {},
        {"../escape.txt": b"x"},
        {"nested.bin": b"PK\x03\x04payload"},
        {"nested.zip": b"fake"},
        {"A.txt": b"a", "a.txt": b"b"},
        {"file": b"a", "file/child": b"b"},
    ],
)
def test_unsafe_archives_rejected(tmp_path, extension, entries):
    with pytest.raises(ValueError):
        convert(
            archive(extension, entries),
            "zip-to-tar" if extension == "zip" else "tar-to-zip",
            tmp_path,
        )
    assert not (tmp_path.parent / "escape.txt").exists()


def test_safe_bomb_simulation_and_member_bounds(tmp_path):
    for entries in [{"bomb.txt": b"0" * 200000}, {f"{i}.txt": b"x" for i in range(101)}]:
        with pytest.raises(ValueError):
            convert(archive("zip", entries), "zip-to-tar", tmp_path)
    # Header-declared expansion beyond policy, without allocating the claimed payload.
    header = tarfile.TarInfo("large.bin")
    header.size = MEMBER_LIMIT + 1
    with pytest.raises(ValueError):
        read_members(header.tobuf() + b"\0" * 1024, "tar")
    assert EXPANDED_LIMIT < 32 * 1024 * 1024


def test_symlink_hardlink_special_and_encrypted_inputs_rejected(tmp_path):
    for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w") as result:
            item = tarfile.TarInfo("link")
            item.type = kind
            item.linkname = "/etc/passwd"
            result.addfile(item)
        with pytest.raises(ValueError):
            convert(stream.getvalue(), "tar-to-zip", tmp_path)
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as result:
        item = zipfile.ZipInfo("link")
        item.external_attr = (stat.S_IFLNK | 0o777) << 16
        result.writestr(item, "/etc/passwd")
    with pytest.raises(ValueError):
        convert(stream.getvalue(), "zip-to-tar", tmp_path)
    data = bytearray(archive())
    central = data.index(b"PK\x01\x02")
    data[6] |= 1
    data[central + 8] |= 1
    with pytest.raises(ValueError):
        convert(data, "zip-to-tar", tmp_path)


def test_corrupt_archive_crc_rejected(tmp_path):
    data = bytearray(archive())
    data[50] ^= 0xFF
    with pytest.raises((ValueError, zipfile.BadZipFile, RuntimeError)):
        convert(data, "zip-to-tar", tmp_path)

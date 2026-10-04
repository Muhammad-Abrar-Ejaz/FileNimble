"""Allowlisted PCM/FLAC and VP8/Vorbis WebM operations; never accept CLI options."""

import json
import math
import struct
import subprocess
import zipfile
import zlib
from fractions import Fraction
from pathlib import Path

from phase11_policy import AUDIO_SECONDS, OUTPUT_LIMIT, TOOLS, VIDEO_SECONDS

FFMPEG = "/usr/local/bin/ffmpeg"
FFPROBE = "/usr/local/bin/ffprobe"


def run(args, timeout=30):
    result = subprocess.run(args, capture_output=True, timeout=timeout, check=True)  # noqa: S603 -- fixed executables and trusted generated paths; no shell.
    if result.stderr.strip():
        raise ValueError("CORRUPT_FILE")
    return result.stdout


def probe(path, extension):
    fmt = {"webm": "matroska", "wav": "wav", "flac": "flac"}[extension]
    data = json.loads(
        run(
            [
                FFPROBE,
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-f",
                fmt,
                "-show_entries",
                "format=format_name,duration:stream=index,codec_name,codec_type,sample_rate,channels,bits_per_raw_sample,width,height,avg_frame_rate,nb_read_frames",
                "-of",
                "json",
                str(path),
            ]
        )
    )
    duration = float(data["format"]["duration"])
    if not math.isfinite(duration) or not 0 < duration <= (
        VIDEO_SECONDS if extension == "webm" else AUDIO_SECONDS
    ):
        raise ValueError("RESOURCE_LIMIT")
    streams = data["streams"]
    if not 1 <= len(streams) <= (2 if extension == "webm" else 1):
        raise ValueError("UNSUPPORTED_FORMAT")
    audio, video = [], []
    for stream in streams:
        if stream["codec_type"] == "audio":
            codec = {"wav": "pcm_s16le", "flac": "flac", "webm": "vorbis"}[extension]
            if (
                stream["codec_name"] != codec
                or not 1 <= stream["channels"] <= 2
                or not 8000 <= int(stream["sample_rate"]) <= 48000
            ):
                raise ValueError("UNSUPPORTED_FORMAT")
            if extension == "flac" and int(stream.get("bits_per_raw_sample", 0)) != 16:
                raise ValueError("UNSUPPORTED_FORMAT")
            audio.append(stream)
        elif stream["codec_type"] == "video" and extension == "webm":
            if (
                stream["codec_name"] != "vp8"
                or not 1 <= stream["width"] <= 640
                or not 1 <= stream["height"] <= 360
                or not 0 < Fraction(stream["avg_frame_rate"]) <= 30
            ):
                raise ValueError("RESOURCE_LIMIT")
            counted = json.loads(
                run(
                    [
                        FFPROBE,
                        "-v",
                        "error",
                        "-protocol_whitelist",
                        "file",
                        "-f",
                        "matroska",
                        "-select_streams",
                        "v:0",
                        "-count_frames",
                        "-show_entries",
                        "stream=nb_read_frames",
                        "-of",
                        "json",
                        str(path),
                    ]
                )
            )
            stream["nb_read_frames"] = counted["streams"][0]["nb_read_frames"]
            if not 0 < int(stream["nb_read_frames"]) <= 300:
                raise ValueError("RESOURCE_LIMIT")
            video.append(stream)
        else:
            raise ValueError("UNSUPPORTED_FORMAT")
    if len(video) != (1 if extension == "webm" else 0) or len(audio) > 1:
        raise ValueError("UNSUPPORTED_FORMAT")
    return duration, audio, video


def input_args(source):
    return [
        FFMPEG,
        "-hide_banner",
        "-loglevel",
        "error",
        "-xerror",
        "-nostdin",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file",
        "-i",
        str(source),
    ]


def validate_png(data, width, height):
    if data[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack("!II", data[16:24]) != (width, height):
        raise ValueError("INVALID_OUTPUT")
    offset = 8
    while offset < len(data):
        length = int.from_bytes(data[offset : offset + 4], "big")
        chunk = data[offset + 4 : offset + 8 + length]
        crc = data[offset + 8 + length : offset + 12 + length]
        if len(crc) != 4 or zlib.crc32(chunk) != int.from_bytes(crc, "big"):
            raise ValueError("INVALID_OUTPUT")
        offset += length + 12
        if chunk[:4] == b"IEND":
            if offset != len(data):
                raise ValueError("INVALID_OUTPUT")
            return
    raise ValueError("INVALID_OUTPUT")


def convert(data, tool, work=Path("/work")):
    _, extension, _, target, media_type, _ = TOOLS[tool]
    source, output = work / ("input." + extension), work / ("result." + target)
    source.write_bytes(data)
    duration, audio, video = probe(source, extension)
    # Decode every selected stream before remux/extraction; container metadata alone is insufficient.
    run(input_args(source) + ["-map", "0", "-f", "null", "-"], timeout=30)
    if tool == "video-to-frames":
        frames = []
        for second in range(
            math.ceil(
                min(
                    duration,
                    int(video[0]["nb_read_frames"]) / float(Fraction(video[0]["avg_frame_rate"])),
                )
            )
        ):
            frame = work / f"frame-{second:03d}-at-{second}s.png"
            run(
                input_args(source)
                + [
                    "-ss",
                    str(second),
                    "-map",
                    "0:v:0",
                    "-frames:v",
                    "1",
                    "-map_metadata",
                    "-1",
                    "-threads",
                    "1",
                    "-c:v",
                    "png",
                    "-y",
                    str(frame),
                ]
            )
            content = frame.read_bytes()
            validate_png(content, video[0]["width"], video[0]["height"])
            frames.append((frame.name, content))
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
            for name, content in frames:
                archive.writestr(zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0)), content)
        with zipfile.ZipFile(output) as archive:
            if archive.testzip() or archive.namelist() != [name for name, _ in frames]:
                raise ValueError("INVALID_OUTPUT")
    else:
        if not audio:
            raise ValueError("AUDIO_STREAM_REQUIRED")
        args = input_args(source) + ["-map_metadata", "-1", "-map_chapters", "-1"]
        if tool == "video-mute":
            args += ["-map", "0:v:0", "-c:v", "copy", "-an"]
        else:
            args += [
                "-map",
                "0:a:0",
                "-vn",
                "-c:a",
                "flac" if target == "flac" else "pcm_s16le",
                "-ar",
                str(audio[0]["sample_rate"]),
                "-ac",
                str(audio[0]["channels"]),
                "-threads",
                "1",
            ]
        run(args + ["-y", str(output)])
        out_duration, out_audio, out_video = probe(output, target)
        if abs(duration - out_duration) > 0.15:
            raise ValueError("INVALID_OUTPUT")
        if tool == "video-mute":
            if (
                out_audio
                or len(out_video) != 1
                or any(
                    out_video[0][key] != video[0][key]
                    for key in ("width", "height", "nb_read_frames")
                )
            ):
                raise ValueError("INVALID_OUTPUT")
        elif len(out_audio) != 1 or any(
            out_audio[0][key] != audio[0][key] for key in ("sample_rate", "channels")
        ):
            raise ValueError("INVALID_OUTPUT")
        run(input_args(output) + ["-map", "0", "-f", "null", "-"], timeout=30)
    if not 0 < output.stat().st_size <= OUTPUT_LIMIT:
        raise ValueError("RESOURCE_LIMIT")
    return output, {"pages": 1, "mediaType": media_type}

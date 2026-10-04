"""Fixed Phase 11 contracts shared by API, controller and disposable engines."""

INPUT_LIMIT = 25 * 1024 * 1024
OUTPUT_LIMIT = 32 * 1024 * 1024
ARCHIVE_INPUT_LIMIT = 10 * 1024 * 1024
MEMBER_LIMIT = 8 * 1024 * 1024
EXPANDED_LIMIT = 24 * 1024 * 1024
MEMBER_COUNT = 100
AUDIO_SECONDS = 60
VIDEO_SECONDS = 10
TOOLS = {
    "wav-to-flac": ("FN-171", "wav", "audio/wav", "flac", "audio/flac", "media"),
    "flac-to-wav": ("FN-171", "flac", "audio/flac", "wav", "audio/wav", "media"),
    "video-mute": ("FN-172", "webm", "video/webm", "webm", "video/webm", "media"),
    "video-to-wav": ("FN-172", "webm", "video/webm", "wav", "audio/wav", "media"),
    "video-to-frames": ("FN-172", "webm", "video/webm", "zip", "application/zip", "media"),
    "tar-to-zip": ("FN-175", "tar", "application/x-tar", "zip", "application/zip", "archive"),
    "zip-to-tar": ("FN-175", "zip", "application/zip", "tar", "application/x-tar", "archive"),
}


def signature_valid(data, extension):
    if extension == "wav":
        return data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if extension == "tar":
        return len(data) >= 512 and data[257:262] == b"ustar"
    return data.startswith(
        {"flac": b"fLaC", "webm": b"\x1aE\xdf\xa3", "zip": b"PK\x03\x04"}[extension]
    )

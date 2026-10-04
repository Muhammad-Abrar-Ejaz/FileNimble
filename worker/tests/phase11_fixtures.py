"""Small deterministic files made by this project, never user uploads."""

import io
import math
import struct
import tarfile
import wave
import zipfile


def audio(seconds=1, rate=16000, channels=1):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(
            b"".join(
                struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * n / rate))) * channels
                for n in range(int(seconds * rate))
            )
        )
    return output.getvalue()


def archive(extension="zip", entries=None):
    entries = (
        entries
        if entries is not None
        else {"notes/one.txt": b"FileNimble first file\n", "two.txt": b"Second generated fixture\n"}
    )
    output = io.BytesIO()
    if extension == "zip":
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as target:
            for name, data in entries.items():
                target.writestr(name, data)
    else:
        with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as target:
            for name, data in entries.items():
                item = tarfile.TarInfo(name)
                item.size = len(data)
                target.addfile(item, io.BytesIO(data))
    return output.getvalue()

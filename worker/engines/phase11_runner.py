"""Same bounded native framing, with no backend packages or secrets in the image."""

import json
import struct
import sys
from pathlib import Path

from phase11_policy import INPUT_LIMIT, OUTPUT_LIMIT, TOOLS, signature_valid


def exact(stream, length):
    data = bytearray()
    while len(data) < length:
        chunk = stream.read(min(65536, length - len(data)))
        if not chunk:
            raise ValueError("CORRUPT_FILE")
        data.extend(chunk)
    return data


def main():
    try:
        stream = sys.stdin.buffer
        length = struct.unpack("!I", exact(stream, 4))[0]
        if not 0 < length <= 4096:
            raise ValueError("INVALID_REQUEST")
        request = json.loads(exact(stream, length))
        if (
            set(request) != {"tool", "size"}
            or request["tool"] not in TOOLS
            or type(request["size"]) is not int
            or not 0 < request["size"] <= INPUT_LIMIT
        ):
            raise ValueError("INVALID_REQUEST")
        tool = request["tool"]
        data = exact(stream, request["size"])
        if not signature_valid(data, TOOLS[tool][1]):
            raise ValueError("CORRUPT_FILE")
        if TOOLS[tool][-1] == "archive":
            from archives import convert
        else:
            from media import convert
        output, result = convert(data, tool)
        del data
        result["size"] = output.stat().st_size
        if not 0 < result["size"] <= OUTPUT_LIMIT:
            raise ValueError("RESOURCE_LIMIT")
        result["peakMemoryBytes"] = int(Path("/sys/fs/cgroup/memory.peak").read_text())
        header = json.dumps(result).encode()
        sys.stdout.buffer.write(struct.pack("!I", len(header)) + header)
        with output.open("rb") as source:
            while chunk := source.read(65536):
                sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()
    except Exception:
        header = b'{"error":"CONVERSION_FAILED"}'
        sys.stdout.buffer.write(struct.pack("!I", len(header)) + header)
        sys.stdout.buffer.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()

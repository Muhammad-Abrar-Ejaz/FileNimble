"""Explicit local engine benchmark. Outputs contain metrics only, never document bytes.

Run in the trusted development harness with Docker authority, not in a converter.
"""

import json
import socket
import struct
import time

import docker

from test_native_validation import package
from phase11_policy import TOOLS as PHASE11_TOOLS, signature_valid


def qualify(
    memory,
    tool="word-to-pdf",
    data=None,
    family="office",
    expected_pages=1,
    expect_error=False,
    options=None,
):
    engine = docker.from_env(timeout=10)
    container = None
    connection = None
    started = time.monotonic()
    try:
        container = engine.containers.create(
            f"filenimble-{family}:phase11"
            if family in {"media", "archive"}
            else f"filenimble-{family}:phase7"
            if family == "ocr"
            else f"filenimble-{family}:phase6",
            user="10001:10001",
            read_only=True,
            stdin_open=True,
            network_mode="none",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit=memory,
            memswap_limit=memory,
            nano_cpus=1_000_000_000,
            pids_limit=64,
            tmpfs={
                "/work": "rw,noexec,nosuid,nodev,size=128m,uid=10001,gid=10001,mode=700"
                if family in {"media", "archive"}
                else "rw,noexec,nosuid,nodev,size=256m,uid=10001,gid=10001,mode=700",
                "/tmp": "rw,noexec,nosuid,nodev,size=32m,uid=10001,gid=10001,mode=700",  # noqa: S108 -- private per-job tmpfs.
            },
            log_config=docker.types.LogConfig(type="none"),
        )
        container.start()
        connection = container.attach_socket(params={"stdin": True, "stdout": True, "stream": True})
        connection._sock.settimeout(5)
        data = package() if data is None else data
        request = {"tool": tool, "size": len(data)}
        if family == "ocr":
            request["options"] = options or {"language": "eng", "cleanup": True}
        header = json.dumps(request).encode()
        connection._sock.sendall(struct.pack("!I", len(header)) + header + data)
        connection._sock.settimeout(0.5)
        frames, output = bytearray(), bytearray()
        peak = 0
        sampled_at = 0
        while time.monotonic() - started < 120:
            if time.monotonic() - sampled_at >= 1:
                container.reload()
                if container.status == "running":
                    stats = container.stats(stream=False, one_shot=True)
                    peak = max(peak, stats.get("memory_stats", {}).get("usage", 0))
                sampled_at = time.monotonic()
            try:
                chunk = connection._sock.recv(65536)
            except socket.timeout:
                continue
            if not chunk:
                break
            frames.extend(chunk)
            while len(frames) >= 8:
                size = int.from_bytes(frames[4:8], "big")
                if size > 1048576 or len(output) > 100 * 1024 * 1024:
                    raise RuntimeError("Output exceeds bound")
                if len(frames) < 8 + size:
                    break
                assert frames[0] == 1
                output.extend(frames[8 : 8 + size])
                del frames[: 8 + size]
        container.reload()
        assert len(output) >= 4, (
            f"No output; exit={container.attrs['State'].get('ExitCode')} oom={container.attrs['State'].get('OOMKilled')}"
        )
        size = struct.unpack("!I", output[:4])[0]
        metadata = json.loads(output[4 : 4 + size])
        if expect_error:
            assert "error" in metadata
            return None
        assert "error" not in metadata, metadata
        pdf = output[4 + size :]
        signatures = (
            (b"\xef\xbb\xbf",)
            if tool in {"image-to-text", "pdf-to-text"}
            else (b"%PDF-", b"PK\x03\x04")
        )
        assert (
            signature_valid(pdf, PHASE11_TOOLS[tool][3])
            if tool in PHASE11_TOOLS
            else pdf.startswith(signatures)
        ) and len(pdf) == metadata["size"]
        assert metadata["pages"] == expected_pages
        print(
            json.dumps(
                {
                    "memory": memory,
                    "tool": tool,
                    "peak_bytes": metadata.get("peakMemoryBytes", peak),
                    "seconds": round(time.monotonic() - started, 2),
                    "output_bytes": len(pdf),
                    "pages": metadata["pages"],
                }
            )
        )
        return bytes(pdf)
    finally:
        if connection:
            connection.close()
        if container:
            container.remove(force=True)
        engine.close()


if __name__ == "__main__":
    qualify("256m")
    qualify("512m")

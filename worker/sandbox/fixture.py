"""Non-public platform fixture. No Office/PDF/OCR converter is implemented here."""

import errno
import base64
import json
import os
from pathlib import Path
import socket
import sys
import time

envelope = json.loads(sys.stdin.buffer.readline(1_500_001))
options = envelope["options"]
data = base64.b64decode(envelope["data"], validate=True)
if len(data) > 1024 * 1024:
    raise SystemExit(2)
Path("input.bin").write_bytes(data)
if not data.startswith(b"%FN-FIXTURE\n"):
    raise SystemExit(2)
behavior = options["behavior"]
if behavior in ("delay", "timeout"):
    time.sleep(4 if behavior == "delay" else 120)
if behavior == "memory":
    memory = bytearray(512 * 1024 * 1024)
if behavior == "probe":
    evidence = {
        "uid": os.getuid(),
        "environment": sorted(os.environ),
        "socket": Path("/var/run/docker.sock").exists(),
    }
    try:
        Path("/root-write-test").write_bytes(b"x")
        evidence["readonly"] = False
    except OSError as error:
        evidence["readonly"] = error.errno == errno.EROFS
    try:
        with socket.create_connection(("1.1.1.1", 443), timeout=0.2):
            evidence["network_blocked"] = False
    except OSError:
        evidence["network_blocked"] = True
    status = Path("/proc/self/status").read_text()
    evidence["capabilities_dropped"] = "CapEff:\t0000000000000000" in status
    evidence["no_new_privileges"] = "NoNewPrivs:\t1" in status
    evidence["cpu_max"] = Path("/sys/fs/cgroup/cpu.max").read_text().strip()
    deadline = time.monotonic() + 1.2
    while time.monotonic() < deadline:
        sum(range(1000))
    cpu_stats = dict(
        line.split() for line in Path("/sys/fs/cgroup/cpu.stat").read_text().splitlines()
    )
    evidence["cpu_throttled"] = int(cpu_stats["nr_throttled"]) > 0
    evidence["memory_max"] = Path("/sys/fs/cgroup/memory.max").read_text().strip()
    evidence["pids_max"] = Path("/sys/fs/cgroup/pids.max").read_text().strip()
    children = []
    try:
        for _ in range(40):
            pid = os.fork()
            if pid == 0:
                time.sleep(120)
                os._exit(0)
            children.append(pid)
        evidence["pids_enforced"] = False
    except OSError as error:
        evidence["pids_enforced"] = error.errno == errno.EAGAIN
    finally:
        for pid in children:
            os.kill(pid, 9)
            os.waitpid(pid, 0)
    try:
        with open("fill", "wb") as stream:
            for _ in range(32):
                stream.write(b"x" * 1024 * 1024)
        evidence["scratch_bounded"] = False
    except OSError as error:
        evidence["scratch_bounded"] = error.errno == errno.ENOSPC
    Path("fill").unlink(missing_ok=True)
    result = json.dumps(evidence).encode()
elif behavior == "invalid-output":
    result = b"invalid"
elif behavior == "large-output":
    result = b"x" * (1024 * 1024 + 1)
else:
    result = b"%FN-RESULT\n" + data[len(b"%FN-FIXTURE\n") :].upper()
Path("output.pending").write_bytes(result)
Path("output.pending").replace("output.bin")
sys.stdout.buffer.write(base64.b64encode(result) + b"\n")
sys.stdout.buffer.flush()
# Keep tmpfs mounted until the trusted controller retrieves output and kills the container.
while True:
    time.sleep(1)

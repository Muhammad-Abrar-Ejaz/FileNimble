"""Trusted native controller transport. Scratch is private bounded tmpfs.

Only fixed images and adapters are accepted. No host files enter a sandbox.
"""

import json
import os
import socket
import struct
import tempfile
import threading
import time
from pathlib import Path
from uuid import UUID

import docker
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from phase11_policy import TOOLS as PHASE11_TOOLS, OUTPUT_LIMIT, ARCHIVE_INPUT_LIMIT
from app.capabilities import get_capability

router = APIRouter()
runs = {}
lock = threading.Lock()
slots = threading.BoundedSemaphore(1)
NAMESPACE = os.getenv("RUNNER_NAMESPACE", "local-phase6")
MAX_INPUT = 25 * 1024 * 1024
MAX_OUTPUT = 100 * 1024 * 1024
TOOLS = {"word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf"}
TOOLS.update({"html-to-pdf", "compress-pdf", "repair-pdf", "pdf-to-powerpoint", "pdf-to-excel"})
TOOLS.update({"image-to-text", "pdf-to-text", "ocr-pdf"})
TOOLS.update(
    {
        "csv-to-xlsx",
        "xlsx-to-csv",
        "json-to-xlsx",
        "xlsx-to-json",
        "markdown-to-pdf",
        "markdown-to-docx",
        "docx-to-markdown",
        "txt-to-pdf",
        "rtf-to-pdf",
    }
)

TOOLS.update(PHASE11_TOOLS)


def policy(tool):
    if tool in PHASE11_TOOLS:
        spec = PHASE11_TOOLS[tool]
        return spec[-1], "256m" if spec[-1] == "media" else "128m", spec[4], b""
    if tool in {"image-to-text", "pdf-to-text", "ocr-pdf"}:
        return (
            "ocr",
            "512m",
            "application/pdf" if tool == "ocr-pdf" else "text/plain; charset=utf-8",
            b"%PDF-" if tool == "ocr-pdf" else b"\xef\xbb\xbf",
        )
    if tool in {"word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "rtf-to-pdf"}:
        return "office", "512m", "application/pdf", b"%PDF-"
    if tool in {"html-to-pdf", "markdown-to-pdf", "txt-to-pdf"}:
        return "html", "512m", "application/pdf", b"%PDF-"
    if tool in {"compress-pdf", "repair-pdf"}:
        return "utility", "256m", "application/pdf", b"%PDF-"
    if tool == "pdf-to-powerpoint":
        return (
            "extraction",
            "512m",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            b"PK\x03\x04",
        )
    if tool in {"pdf-to-excel", "csv-to-xlsx", "json-to-xlsx"}:
        return (
            "extraction",
            "512m",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            b"PK\x03\x04",
        )
    if tool == "markdown-to-docx":
        return (
            "extraction",
            "512m",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"PK\x03\x04",
        )
    if tool == "xlsx-to-csv":
        return "extraction", "512m", "text/csv; charset=utf-8", b""
    if tool == "xlsx-to-json":
        return "extraction", "512m", "application/json; charset=utf-8", b""
    if tool == "docx-to-markdown":
        return "extraction", "512m", "text/markdown; charset=utf-8", b""
    return (
        "extraction",
        "512m",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        b"PK\x03\x04",
    )


def execute(record):
    engine = docker.from_env(timeout=5)
    container = connection = None
    try:
        family, memory, media_type, signature = policy(record["tool"])
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
            labels={"filenimble.sandbox": NAMESPACE, "filenimble.started": str(time.time())},
            log_config=docker.types.LogConfig(type="none"),
        )
        container.start()
        connection = container.attach_socket(params={"stdin": True, "stdout": True, "stream": True})
        connection._sock.settimeout(5)
        metadata = {"tool": record["tool"], "size": record["input"].stat().st_size}
        if family == "ocr":
            metadata["options"] = record["options"]
        header = json.dumps(metadata).encode()
        connection._sock.sendall(struct.pack("!I", len(header)) + header)
        with record["input"].open("rb") as source:
            while chunk := source.read(65536):
                connection._sock.sendall(chunk)
        record["input"].unlink(missing_ok=True)
        connection._sock.settimeout(0.2)
        frames, payload = bytearray(), bytearray()
        metadata = None
        written = 0
        output_limit = OUTPUT_LIMIT if record["tool"] in PHASE11_TOOLS else MAX_OUTPUT
        deadline = time.monotonic() + (
            90 if family == "media" else 30 if family == "archive" else 120
        )
        with record["output"].open("wb") as output:
            while time.monotonic() < deadline:
                if record["cancel"].is_set():
                    raise ValueError("CANCELLED")
                try:
                    chunk = connection._sock.recv(65536)
                except socket.timeout:
                    continue
                if not chunk:
                    break
                frames.extend(chunk)
                while len(frames) >= 8:
                    length = int.from_bytes(frames[4:8], "big")
                    if frames[0] != 1 or length > 1048576:
                        raise ValueError("INVALID_OUTPUT")
                    if len(frames) < length + 8:
                        break
                    payload.extend(frames[8 : 8 + length])
                    del frames[: 8 + length]
                    if metadata is None:
                        if len(payload) < 4:
                            continue
                        size = struct.unpack("!I", payload[:4])[0]
                        if not 0 < size <= 4096:
                            raise ValueError("INVALID_OUTPUT")
                        if len(payload) < 4 + size:
                            continue
                        metadata = json.loads(payload[4 : 4 + size])
                        del payload[: 4 + size]
                        if (
                            set(metadata) - {"peakMemoryBytes", "rows", "columns", "count"}
                            != {"size", "pages", "mediaType"}
                            or metadata["mediaType"] != media_type
                            or not 1 <= metadata["pages"] <= 200
                            or not 0 < metadata["size"] <= output_limit
                        ):
                            raise ValueError("INVALID_OUTPUT")
                    written += len(payload)
                    if written > output_limit:
                        raise ValueError("RESOURCE_LIMIT")
                    output.write(payload)
                    payload.clear()
            else:
                raise ValueError("CONVERSION_TIMEOUT")
        if not metadata or written != metadata["size"]:
            raise ValueError("INVALID_OUTPUT")
        with record["output"].open("rb") as output:
            if signature and output.read(len(signature)) != signature:
                raise ValueError("INVALID_OUTPUT")
        record["metadata"] = metadata
    except Exception as error:
        allowed = {"CANCELLED", "INVALID_OUTPUT", "RESOURCE_LIMIT", "CONVERSION_TIMEOUT"}
        record["error"] = str(error) if str(error) in allowed else "CONVERSION_FAILED"
        record["output"].unlink(missing_ok=True)
    finally:
        if connection:
            connection.close()
        if container:
            try:
                container.remove(force=True)
            except Exception:
                record["error"] = "SERVICE_UNAVAILABLE"
        engine.close()
        record["input"].unlink(missing_ok=True)
        record["done"] = True
        record["finished"] = time.monotonic()
        slots.release()


def sweep():
    with lock:
        for key, record in list(runs.items()):
            if record["done"] and time.monotonic() - record["finished"] > 60:
                record["folder"].cleanup()
                del runs[key]


@router.post("/native/{run_id}/{tool}", status_code=202)
async def start(run_id: UUID, tool: str, request: Request):
    if os.getenv("APP_ENV") == "production":
        try:
            get_capability(tool)
        except ValueError:
            raise HTTPException(404, "Unsupported capability") from None
        if os.getenv("PRODUCTION_CONVERSIONS_ENABLED", "false") != "true":
            raise HTTPException(503, "Deployment verification is pending")
    if tool not in TOOLS:
        raise HTTPException(404, "Unsupported capability")
    options = {}
    if tool in {"image-to-text", "pdf-to-text", "ocr-pdf"}:
        if (
            set(request.query_params) - {"language", "cleanup"}
            or request.query_params.get("language", "eng") != "eng"
            or request.query_params.get("cleanup", "true") not in {"true", "false"}
        ):
            raise HTTPException(422, "Unsupported OCR options")
        options = {
            "language": "eng",
            "cleanup": request.query_params.get("cleanup", "true") == "true",
        }
    sweep()
    with lock:
        if str(run_id) in runs:
            raise HTTPException(409, "Attempt exists")
        if not slots.acquire(blocking=False):
            raise HTTPException(503, "At capacity")
        folder = tempfile.TemporaryDirectory(prefix="fn-native-")
        record = {
            "folder": folder,
            "input": Path(folder.name) / "input",
            "output": Path(folder.name) / "output",
            "tool": tool,
            "options": options,
            "cancel": threading.Event(),
            "done": False,
        }
        runs[str(run_id)] = record
    try:
        size = 0
        with record["input"].open("wb") as target:
            async for chunk in request.stream():
                size += len(chunk)
                if size > (
                    ARCHIVE_INPUT_LIMIT
                    if tool in PHASE11_TOOLS and PHASE11_TOOLS[tool][-1] == "archive"
                    else MAX_INPUT
                ):
                    raise HTTPException(413, "Input too large")
                target.write(chunk)
        if not size:
            raise HTTPException(400, "Empty input")
    except BaseException:
        with lock:
            runs.pop(str(run_id), None)
        folder.cleanup()
        slots.release()
        raise
    threading.Thread(target=execute, args=(record,), daemon=True).start()
    return {"run_id": str(run_id)}


def lookup(run_id):
    record = runs.get(str(run_id))
    if not record:
        raise HTTPException(404, "Attempt unavailable")
    return record


@router.get("/native/{run_id}")
def status(run_id: UUID):
    record = lookup(run_id)
    return {key: record[key] for key in ("done", "error", "metadata") if key in record}


@router.get("/native/{run_id}/output")
def output(run_id: UUID):
    record = lookup(run_id)
    if not record["done"] or record.get("error"):
        raise HTTPException(409, "Output unavailable")
    return FileResponse(record["output"], media_type="application/octet-stream")


@router.delete("/native/{run_id}")
def cancel(run_id: UUID):
    record = lookup(run_id)
    record["cancel"].set()
    if record["done"]:
        with lock:
            runs.pop(str(run_id), None)
        record["folder"].cleanup()
    return {"cancelled": True}

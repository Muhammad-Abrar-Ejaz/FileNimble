"""Trusted Docker controller. Only this service has host Docker authority."""

import base64
import json
import logging
import os
import socket
import threading
import time
from contextlib import asynccontextmanager
from contextlib import closing
from uuid import UUID

import docker
from docker.errors import NotFound
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.schemas import Options
from app.native_runner import (
    router as native_router,
    sweep as native_sweep,
    NAMESPACE as native_namespace,
)

LABEL = "filenimble.sandbox"
NAMESPACE = os.getenv("RUNNER_NAMESPACE", "local-phase5")
if os.getenv("RUNNER_NAMESPACE"):
    NAMESPACE += "-fixture"
IMAGE = "filenimble-sandbox:phase5"
lock = threading.Lock()
runs = {}
slots = threading.BoundedSemaphore(2)


def docker_client():
    return docker.from_env(timeout=5)


def reset_owned_containers(stale_only=False):
    with closing(docker_client()) as engine:
        for container in engine.containers.list(
            all=True, filters={"label": f"{LABEL}={native_namespace}"}
        ):
            created = float(container.labels.get("filenimble.started", "0"))
            if not stale_only or time.time() - created > 150:
                container.remove(force=True)
        for container in engine.containers.list(
            all=True, filters={"label": f"{LABEL}={NAMESPACE}"}
        ):
            created = float(container.labels.get("filenimble.started", "0"))
            if not stale_only or time.time() - created > 30:
                container.remove(force=True)


def reap_abandoned(stop):
    while not stop.wait(5):
        try:
            reset_owned_containers(stale_only=True)
            native_sweep()
        except Exception:
            logging.getLogger("supervisor").error("sandbox_reaper_unavailable")


@asynccontextmanager
async def lifespan(app):
    if len(os.getenv("RUNNER_SECRET", "")) < 32:
        raise RuntimeError("Missing supervisor authentication")
    reset_owned_containers()
    stop = threading.Event()
    thread = threading.Thread(target=reap_abandoned, args=(stop,), daemon=True)
    thread.start()
    yield
    stop.set()
    thread.join(timeout=6)
    reset_owned_containers()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(native_router)


@app.middleware("http")
async def authenticate(request: Request, call_next):
    import hmac
    from fastapi.responses import JSONResponse

    if not hmac.compare_digest(
        request.headers.get("x-runner-key", ""), os.environ["RUNNER_SECRET"]
    ):
        return JSONResponse({"error": "NOT_AUTHORIZED"}, status_code=401)
    if os.getenv("APP_ENV") == "production" and not request.url.path.startswith("/native/"):
        return JSONResponse({"error": "NOT_AUTHORIZED"}, status_code=404)
    if request.url.path.startswith("/native/"):
        return await call_next(request)
    size = 0
    chunks = []
    async for chunk in request.stream():
        size += len(chunk)
        if size > 1_500_000:
            return JSONResponse({"error": "FILE_TOO_LARGE"}, status_code=413)
        chunks.append(chunk)
    request._body = b"".join(chunks)
    return await call_next(request)


class Run(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: UUID
    data: str = Field(max_length=1_400_000)
    options: Options


def execute(run_id, data, options, record):
    container = None
    engine = None
    connection = None
    try:
        engine = docker_client()
        container = engine.containers.create(
            IMAGE,
            name=f"fn-job-{run_id}",
            user="10001:10001",
            read_only=True,
            stdin_open=True,
            network_mode="none",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit="64m",
            memswap_limit="64m",
            nano_cpus=500_000_000,
            pids_limit=16,
            tmpfs={"/work": "rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=700"},
            labels={LABEL: NAMESPACE, "filenimble.started": str(time.time())},
            log_config=docker.types.LogConfig(type="none"),
        )
        container.start()
        connection = container.attach_socket(params={"stdin": True, "stdout": True, "stream": True})
        connection._sock.settimeout(5)
        connection._sock.sendall(
            json.dumps({"data": base64.b64encode(data).decode(), "options": options}).encode()
            + b"\n"
        )
        connection._sock.settimeout(0.2)
        frames = bytearray()
        output = bytearray()
        deadline = time.monotonic() + 10
        while True:
            container.reload()
            if container.status == "exited":
                state = container.attrs["State"]
                record["error"] = (
                    "RESOURCE_LIMIT"
                    if state["OOMKilled"] or state["ExitCode"] == 137
                    else "CONVERSION_FAILED"
                )
                return
            if record["cancel"].is_set():
                record["error"] = "CANCELLED"
                return
            if time.monotonic() >= deadline:
                record["error"] = "CONVERSION_TIMEOUT"
                return
            try:
                chunk = connection._sock.recv(65536)
            except socket.timeout:
                continue
            if not chunk:
                continue
            frames.extend(chunk)
            # Docker non-TTY attachment frames: stream byte, padding, big-endian length.
            while len(frames) >= 8:
                length = int.from_bytes(frames[4:8], "big")
                if frames[0] != 1 or length > 1_400_000:
                    record["error"] = "INVALID_OUTPUT"
                    return
                if len(frames) < 8 + length:
                    break
                output.extend(frames[8 : 8 + length])
                del frames[: 8 + length]
                if len(output) > 1_400_000:
                    record["error"] = "RESOURCE_LIMIT"
                    return
                if b"\n" in output:
                    content = base64.b64decode(bytes(output).strip(), validate=True)
                    if len(content) > 1024 * 1024:
                        record["error"] = "RESOURCE_LIMIT"
                        return
                    record["output"] = base64.b64encode(content).decode()
                    return
    except Exception as error:
        logging.getLogger("supervisor").error(
            "sandbox_execution_failed category=%s", type(error).__name__
        )
        record["error"] = "SERVICE_UNAVAILABLE"
    finally:
        if connection:
            connection.close()
        if container:
            try:
                container.remove(force=True)
            except NotFound:
                pass
            except Exception:
                logging.getLogger("supervisor").error("sandbox_removal_failed")
                record["error"] = "SERVICE_UNAVAILABLE"
        if engine:
            engine.close()
        record["done"] = True
        record["finished"] = time.monotonic()
        slots.release()


@app.post("/runs", status_code=202)
def start(body: Run):
    run_id = str(body.run_id)
    try:
        data = base64.b64decode(body.data, validate=True)
    except ValueError as error:
        raise HTTPException(422, "Invalid input encoding") from error
    if len(data) > 1024 * 1024:
        raise HTTPException(413, "Input too large")
    with lock:
        for key in list(runs):
            if runs[key].get("finished", float("inf")) < time.monotonic() - 60:
                del runs[key]
        if run_id in runs:
            return {"run_id": run_id}
        if not slots.acquire(blocking=False):
            raise HTTPException(503, "Supervisor at capacity")
        record = {"done": False, "cancel": threading.Event()}
        runs[run_id] = record
    threading.Thread(
        target=execute, args=(run_id, data, body.options.model_dump(), record), daemon=True
    ).start()
    return {"run_id": run_id}


@app.get("/runs/{run_id}")
def status(run_id: UUID):
    record = runs.get(str(run_id))
    if record is None:
        raise HTTPException(404, "Attempt unavailable")
    return {key: record[key] for key in ("done", "error", "output") if key in record}


@app.delete("/runs/{run_id}")
def cancel(run_id: UUID):
    record = runs.get(str(run_id))
    if record:
        record["cancel"].set()
        if record["done"]:
            with lock:
                runs.pop(str(run_id), None)
    return {"cancelled": True}

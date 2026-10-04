import asyncio
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from psycopg import OperationalError

from app import jobs
from app import ai as ai_tools
from app.config import settings
from app.db import connect
from app.schemas import Created, CreateJob, Download, DownloadRequest, Status, Transition
from app.ai import AIRequest
from app.security import digest, fail, issue_session, read_session, require_internal


@asynccontextmanager
async def lifespan(app):
    settings.validate()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
logger = logging.getLogger("platform")


@app.exception_handler(HTTPException)
async def http_error(request, error):
    return JSONResponse(error.detail, status_code=error.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    # Never echo rejected values (they may contain sensitive filenames/options).
    return JSONResponse(
        {"error": "INVALID_REQUEST", "message": "Invalid request fields."}, status_code=422
    )


@app.middleware("http")
async def boundary(request: Request, call_next):
    cookie = None
    try:
        if request.url.path != "/health":
            require_internal(request.headers.get("x-internal-key"))
            body = bytearray()
            max_request_bytes = 50 * 1024 if request.url.path == "/api/v1/ai/process" else 16384
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > max_request_bytes:
                    fail("FILE_TOO_LARGE", "API request is too large.", 413)
            request._body = bytes(body)
            is_ai_process = request.url.path == "/api/v1/ai/process"
            if request.url.path.startswith("/api/v1/jobs") or is_ai_process:
                cookie = request.cookies.get("fn_session")
                if (
                    not cookie
                    and request.method == "POST"
                    and (request.url.path == "/api/v1/jobs" or is_ai_process)
                ):
                    cookie = issue_session()
                if not cookie:
                    fail("NOT_AUTHORIZED", "A session is required.", 401)
                request.state.owner = read_session(cookie)
                request.state.ip = digest(request.headers.get("x-client-ip", "local"))
                jobs.rate_limit("request-owner:" + request.state.owner, 120)
                jobs.rate_limit("request-ip:" + request.state.ip, 600)
                if is_ai_process:
                    jobs.rate_limit("ai-minute-owner:" + request.state.owner, 3)
                    jobs.rate_limit("ai-minute-ip:" + request.state.ip, 10)
                    jobs.rate_limit("ai-minute-global", 10)
                    jobs.rate_limit("ai-daily-owner:" + request.state.owner, 20, 86400)
                    jobs.rate_limit("ai-daily-ip:" + request.state.ip, 100, 86400)
                    jobs.rate_limit("ai-daily-global", 100, 86400)
        response = await call_next(request)
    except HTTPException as error:
        response = JSONResponse(error.detail, status_code=error.status_code)
    except ValueError as error:
        code = "FILE_TOO_LARGE" if str(error) == "FILE_TOO_LARGE" else "INVALID_REQUEST"
        response = JSONResponse(
            {"error": code, "message": "Request or uploaded file is invalid."}, status_code=400
        )
    except (OperationalError, BotoCoreError, ClientError):
        response = JSONResponse(
            {
                "error": "SERVICE_UNAVAILABLE",
                "message": "A required service is unavailable. Retry later.",
            },
            status_code=503,
        )
    except Exception:
        logger.error("request_failed")
        response = JSONResponse(
            {"error": "SERVICE_UNAVAILABLE", "message": "Unable to complete this request."},
            status_code=503,
        )
    if cookie and cookie != request.cookies.get("fn_session"):
        response.set_cookie(
            "fn_session",
            cookie,
            httponly=True,
            secure=settings.environment == "production",
            samesite="strict",
            max_age=settings.session_ttl,
            path="/api/v1",
        )
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


@app.get("/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok"}


def public_tools():
    seen = set()
    result = []
    for tool in json.loads(Path("registry.json").read_text()):
        if tool["slug"] not in seen:
            result.append(tool)
            seen.add(tool["slug"])
    return result


@app.get("/api/v1/tools")
def tools():
    return public_tools()


@app.get("/api/v1/tools/{slug}")
def tool(slug: str):
    for record in public_tools():
        if record["slug"] == slug:
            return record
    fail("UNSUPPORTED_FORMAT", "Unknown tool.", 404)


@app.get("/api/v1/ai/status")
def ai_status():
    provider = ai_tools.provider_from_environment()
    return {"enabled": provider is not None, "provider": provider.name if provider else None}


@app.post("/api/v1/ai/process")
async def ai_process(body: AIRequest, request: Request):
    started = time.monotonic()
    task = asyncio.create_task(ai_tools.process(body))
    try:
        while not task.done():
            done, _ = await asyncio.wait({task}, timeout=0.25)
            if done:
                break
            if await request.is_disconnected():
                task.cancel()
                raise asyncio.CancelledError
        result = await task
    except asyncio.CancelledError:
        task.cancel()
        raise
    except Exception:
        logger.info(
            "ai_request_failed tool=%s elapsed_ms=%d",
            body.tool,
            int((time.monotonic() - started) * 1000),
        )
        raise
    logger.info(
        "ai_request_completed tool=%s provider=%s input_chars=%d output_chars=%d input_tokens=%s output_tokens=%s elapsed_ms=%d",
        body.tool,
        result.provider,
        len(body.text),
        len(result.text),
        result.input_tokens,
        result.output_tokens,
        int((time.monotonic() - started) * 1000),
    )
    return {"result": result.text, "provider": result.provider}


@app.post("/api/v1/jobs", response_model=Created, status_code=201)
def create(body: CreateJob, request: Request):
    key = request.headers.get("idempotency-key", "")
    if not re.fullmatch(r"[a-zA-Z0-9_-]{8,100}", key):
        fail("INVALID_REQUEST", "Provide a valid Idempotency-Key header.", 422)
    return jobs.create(body, request.state.owner, request.state.ip, key)


@app.post("/api/v1/jobs/{job_id}/complete-upload", response_model=Transition)
def finalize(job_id: UUID, request: Request):
    return jobs.finalize(job_id, request.state.owner)


@app.get("/api/v1/jobs/{job_id}", response_model=Status)
def status(job_id: UUID, request: Request):
    return jobs.status(job_id, request.state.owner)


@app.post("/api/v1/jobs/{job_id}/cancel", response_model=Transition)
def cancel(job_id: UUID, request: Request):
    return jobs.cancel(job_id, request.state.owner)


@app.delete("/api/v1/jobs/{job_id}", response_model=Transition)
def delete(job_id: UUID, request: Request):
    return jobs.cancel(job_id, request.state.owner, True)


@app.post("/api/v1/jobs/{job_id}/download-token", response_model=Download)
def download(job_id: UUID, body: DownloadRequest, request: Request):
    return jobs.download(job_id, request.state.owner, body.fileId)


@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    lines = []
    with connect() as db:
        for row in db.execute("SELECT state,count(*) AS n FROM conversion_jobs GROUP BY state"):
            lines.append(f'filenimble_jobs{{state="{row["state"]}"}} {row["n"]}')
        age = db.execute(
            "SELECT COALESCE(EXTRACT(EPOCH FROM now()-min(created_at)),0) AS age FROM conversion_jobs WHERE state='QUEUED'"
        ).fetchone()["age"]
        lines.append(f"filenimble_queue_age_seconds {age}")
        for row in db.execute("SELECT name,value FROM platform_counters"):
            lines.append(f'filenimble_events_total{{event="{row["name"]}"}} {row["value"]}')
        for row in db.execute(
            "SELECT name,EXTRACT(EPOCH FROM now()-seen_at) AS age FROM service_heartbeats"
        ):
            lines.append(
                f'filenimble_heartbeat_age_seconds{{service="{row["name"]}"}} {row["age"]}'
            )
        durations = db.execute(
            "SELECT count(*) AS n, COALESCE(sum(EXTRACT(EPOCH FROM completed_at-started_at)),0) AS total FROM conversion_jobs WHERE completed_at IS NOT NULL AND started_at IS NOT NULL"
        ).fetchone()
        lines.extend(
            [
                f"filenimble_duration_seconds_count {durations['n']}",
                f"filenimble_duration_seconds_sum {durations['total']}",
            ]
        )
    return "\n".join(lines) + "\n"

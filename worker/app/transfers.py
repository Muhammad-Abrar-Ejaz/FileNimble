"""Production streaming capability gateway. S3, credentials and bytes stay off Next.js."""

import asyncio
import shutil
from contextlib import asynccontextmanager

import httpx
import anyio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app import storage
from app.config import require_public_origin, settings
from app.transfer_tokens import MAX_DOWNLOAD, signing_secret, verify
from app.production_policy import conversion_error, parse_allowlist

slots = asyncio.Semaphore(2)


@asynccontextmanager
async def lifespan(app):
    if settings.environment != "production" or settings.s3_endpoint != "http://storage:3900":
        raise RuntimeError("Transfer gateway requires private production storage")
    require_public_origin(settings.site_origin)
    require_public_origin(settings.transfer_public)
    signing_secret()
    parse_allowlist(settings.production_tool_allowlist)
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.middleware("http")
async def boundary(request, call_next):
    origin = request.headers.get("origin")
    if origin and origin != settings.site_origin:
        return JSONResponse({"error": "NOT_AUTHORIZED"}, status_code=403)
    try:
        response = await call_next(request)
    except Exception:
        # Do not log request paths: they contain bearer grants.
        response = JSONResponse({"error": "TRANSFER_UNAVAILABLE"}, status_code=503)
    response.headers.update(
        {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
        }
    )
    if origin == settings.site_origin:
        response.headers["Access-Control-Allow-Origin"] = settings.site_origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Expose-Headers"] = (
            "Content-Length, Content-Type, Content-Disposition"
        )
    return response


@app.api_route("/transfers/{token}", methods=["PUT", "GET", "OPTIONS"])
async def transfer(token: str, request: Request):
    try:
        grant = verify(token)
    except ValueError:
        raise HTTPException(403, "Invalid or expired transfer grant") from None
    if grant["method"] == "PUT":
        if grant["v"] == 2:
            if conversion_error(grant["tool"], settings):
                raise HTTPException(403, "Converter is unavailable in this deployment")
        elif settings.production_conversions:
            # v1 PUT is operator foundation smoke only; never a live conversion grant.
            raise HTTPException(403, "Upload requires a converter-scoped grant")
    if request.method == "OPTIONS":
        if (
            request.headers.get("origin") != settings.site_origin
            or request.headers.get("access-control-request-method") != grant["method"]
            or any(
                header.strip().lower() != "content-type"
                for header in request.headers.get(
                    "access-control-request-headers", "content-type"
                ).split(",")
            )
        ):
            raise HTTPException(403, "Unsupported preflight")
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Methods": grant["method"],
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "60",
            },
        )
    if request.method != grant["method"]:
        raise HTTPException(403, "Grant does not permit this method")
    if request.method == "PUT" and shutil.disk_usage("/").free < 12 * 1024**3:
        raise HTTPException(507, "Storage capacity requires operator attention")
    if slots.locked():
        raise HTTPException(429, "Transfer capacity reached")
    await slots.acquire()
    client = None
    upstream = None
    streaming = False

    async def close_resources():
        # Disconnect cancellation must not interrupt socket cleanup or leak a transfer slot.
        with anyio.CancelScope(shield=True):
            try:
                if upstream is not None:
                    await upstream.aclose()
            finally:
                try:
                    if client is not None:
                        await client.aclose()
                finally:
                    slots.release()

    try:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(60, connect=5), trust_env=False, follow_redirects=False
        )
        if request.method == "PUT":
            if request.headers.get("origin") != settings.site_origin:
                raise HTTPException(403, "Upload origin is required")
            if (
                request.headers.get("content-length") != str(grant["size"])
                or request.headers.get("content-type") != "application/octet-stream"
            ):
                raise HTTPException(413, "Upload size or type does not match the grant")
            url = storage.client().generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.bucket,
                    "Key": grant["key"],
                    "ContentType": "application/octet-stream",
                    "ContentLength": grant["size"],
                },
                ExpiresIn=60,
            )

            async def input_chunks():
                total = 0
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > grant["size"]:
                        raise ValueError("INVALID_UPLOAD")
                    yield chunk
                if total != grant["size"]:
                    raise ValueError("INVALID_UPLOAD")

            upstream = await client.send(
                client.build_request(
                    "PUT",
                    url,
                    content=input_chunks(),
                    headers={
                        "Content-Length": str(grant["size"]),
                        "Content-Type": "application/octet-stream",
                    },
                ),
                stream=True,
            )
            if upstream.status_code not in {200, 204}:
                raise HTTPException(503, "Storage upload unavailable")
            return Response(status_code=204)
        url = storage.client().generate_presigned_url(
            "get_object", Params={"Bucket": settings.bucket, "Key": grant["key"]}, ExpiresIn=60
        )
        upstream = await client.send(
            client.build_request("GET", url, headers={"Accept-Encoding": "identity"}), stream=True
        )
        if upstream.status_code == 404:
            raise HTTPException(404, "Result is no longer available")
        length = int(upstream.headers.get("content-length", "0"))
        if upstream.status_code != 200 or not 0 < length <= MAX_DOWNLOAD:
            raise HTTPException(503, "Invalid storage response")

        async def output_chunks():
            total = 0
            try:
                async for chunk in upstream.aiter_raw():
                    total += len(chunk)
                    if total > length:
                        raise ValueError("INVALID_DOWNLOAD")
                    yield chunk
                if total != length:
                    raise ValueError("INVALID_DOWNLOAD")
            finally:
                await close_resources()

        streaming = True
        return StreamingResponse(
            output_chunks(),
            media_type=grant["media_type"],
            headers={
                "Content-Length": str(length),
                "Content-Disposition": f'attachment; filename="{grant["filename"]}"',
            },
        )
    except (ValueError, httpx.HTTPError):
        raise HTTPException(503, "Transfer failed") from None
    finally:
        if not streaming:
            await close_resources()

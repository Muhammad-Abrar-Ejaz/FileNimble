from phase11_policy import TOOLS as PHASE11_TOOLS, signature_valid as phase11_signature
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from psycopg.types.json import Jsonb

from app import storage
from app.capabilities import CAPABILITIES, get_capability
from app.config import settings
from app.db import connect
from app.security import fail
from app.production_policy import conversion_error

ACTIVE = ("CREATED", "UPLOADING", "VALIDATING", "QUEUED", "PROCESSING")
TERMINAL = ("FAILED", "CANCELLED", "EXPIRED")
GLOBAL_QUEUE_LOCK = "filenimble-global-conversion-admission-v1"


def now():
    return datetime.now(timezone.utc)


def owned(db, job_id, owner):
    job = db.execute(
        "SELECT * FROM conversion_jobs WHERE id=%s AND owner_hash=%s FOR UPDATE", (job_id, owner)
    ).fetchone()
    if not job:
        fail("NOT_AUTHORIZED", "Job is unavailable.", 404)
    return job


def usable(job):
    if job["deleted_at"] or job["expires_at"] <= now() or job["state"] == "EXPIRED":
        fail("JOB_EXPIRED", "This job is no longer available.", 410)
    if job["state"] in ("FAILED", "CANCELLED"):
        fail("JOB_UNAVAILABLE", "This job cannot be used.", 409)


def rate_limit(subject, limit, window_seconds=60):
    window_id = int(time.time()) // window_seconds
    with connect() as db:
        row = db.execute(
            "INSERT INTO quota_windows(subject,window_id,requests) VALUES (%s,%s,1) ON CONFLICT(subject,window_id) DO UPDATE SET requests=quota_windows.requests+1 RETURNING requests",
            (subject, window_id),
        ).fetchone()
    if row["requests"] > limit:
        fail("RATE_LIMITED", "Please wait before trying again.", 429)


def created_response(db, job):
    uploads = []
    if job["state"] == "UPLOADING":
        require_conversion(job["capability"])
        ttl = min(settings.signed_ttl, int((job["upload_expires_at"] - now()).total_seconds()))
        if ttl <= 0:
            fail("JOB_EXPIRED", "The upload window has expired.", 410)
        file = db.execute(
            "SELECT * FROM job_files WHERE job_id=%s AND role='upload'", (job["id"],)
        ).fetchone()
        uploads = [
            {
                "fileId": str(file["id"]),
                "method": "PUT",
                "url": storage.sign_upload(
                    file["object_key"], ttl, job["source_bytes"], tool=job["capability"]
                ),
                "headers": {"Content-Type": "application/octet-stream"},
            }
        ]
    return {
        "jobId": str(job["id"]),
        "state": job["state"],
        "expiresAt": job["expires_at"].isoformat(),
        "uploads": uploads,
    }


def require_conversion(tool):
    error = conversion_error(tool, settings)
    if error:
        fail(error, "This server converter is unavailable in this deployment.",
             503 if error == "SERVICE_UNAVAILABLE" else 400)


def create(request, owner, ip, key):
    require_conversion(request.tool)
    if request.tool == "__fixture__":
        if not settings.fixture or settings.environment != "test":
            fail("UNSUPPORTED_FORMAT", "No server capability is enabled for this tool.")
    else:
        if request.tool not in CAPABILITIES:
            fail("UNSUPPORTED_FORMAT", "No server capability is enabled for this tool.")
        capability = get_capability(request.tool, require_enabled=False)
        if not capability.enabled and not (
            settings.native_test
            and settings.environment == "test"
            and capability.family
            in {"office", "html", "utility", "render", "tables", "ocr", "media", "archive"}
        ):
            fail("UNSUPPORTED_FORMAT", "No server capability is enabled for this tool.")
    fingerprint = hashlib.sha256(
        json.dumps(request.model_dump(), sort_keys=True).encode()
    ).hexdigest()
    size = request.files[0].size
    with connect() as db:
        # Serialize quota reservation and idempotency per IP and session, in stable order.
        for subject in sorted(["ip:" + ip, "owner:" + owner]):
            db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (subject,))
        # Serialize global capacity checks across identities and API replicas.
        db.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (GLOBAL_QUEUE_LOCK,)
        )
        existing = db.execute(
            "SELECT * FROM conversion_jobs WHERE owner_hash=%s AND idempotency_key=%s FOR UPDATE",
            (owner, key),
        ).fetchone()
        if existing:
            if existing["request_hash"] != fingerprint:
                fail(
                    "IDEMPOTENCY_CONFLICT",
                    "This request key was already used for different input.",
                    409,
                )
            usable(existing)
            return created_response(db, existing)
        count = db.execute(
            "SELECT count(*) AS n FROM conversion_jobs WHERE owner_hash=%s AND state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL AND (state!='UPLOADING' OR upload_expires_at>now())",
            (owner, list(ACTIVE)),
        ).fetchone()["n"]
        is_ocr = request.tool in {"image-to-text", "pdf-to-text", "ocr-pdf"}
        if count >= (1 if is_ocr else settings.max_jobs):
            fail("RATE_LIMITED", "Too many active jobs.", 429)
        ip_count = db.execute(
            "SELECT count(*) AS n FROM conversion_jobs WHERE ip_hash=%s AND state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL AND (state!='UPLOADING' OR upload_expires_at>now())",
            (ip, list(ACTIVE)),
        ).fetchone()["n"]
        if ip_count >= settings.max_ip_jobs:
            fail("RATE_LIMITED", "Too many active jobs from this network.", 429)
        global_count = db.execute(
            "SELECT count(*) AS n FROM conversion_jobs WHERE state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL AND (state!='UPLOADING' OR upload_expires_at>now())",
            (list(ACTIVE),),
        ).fetchone()["n"]
        if global_count >= settings.max_global_jobs:
            fail("QUEUE_FULL", "Conversion capacity is full. Try again shortly.", 429)
        global_rate = db.execute(
            "INSERT INTO quota_windows(subject,window_id,requests) VALUES ('create-global',%s,1) ON CONFLICT(subject,window_id) DO UPDATE SET requests=quota_windows.requests+1 RETURNING requests",
            (int(time.time()) // settings.create_rate_global_window_seconds,),
        ).fetchone()["requests"]
        if global_rate > settings.create_rate_global:
            fail("RATE_LIMITED", "The beta conversion allowance is temporarily full.", 429)
        for subject, maximum in [
            (
                "bytes-owner:" + owner,
                (50 if is_ocr else 100 if request.tool != "__fixture__" else 10)
                * settings.max_bytes,
            ),
            (
                "bytes-ip:" + ip,
                (500 if is_ocr else 1000 if request.tool != "__fixture__" else 100)
                * settings.max_bytes,
            ),
        ]:
            row = db.execute(
                "INSERT INTO quota_windows(subject,window_id,bytes) VALUES (%s,%s,%s) ON CONFLICT(subject,window_id) DO UPDATE SET bytes=quota_windows.bytes+EXCLUDED.bytes RETURNING bytes",
                (subject, int(time.time()) // 86400, size),
            ).fetchone()
            if row["bytes"] > maximum:
                fail("RATE_LIMITED", "Upload quota exceeded.", 429)
        job_id = uuid4()
        expiry = now() + timedelta(seconds=settings.retention)
        upload_expiry = now() + timedelta(seconds=settings.signed_ttl)
        db.execute(
            "INSERT INTO conversion_jobs(id,owner_hash,ip_hash,capability,state,options,request_hash,idempotency_key,source_bytes,expires_at,upload_expires_at) VALUES (%s,%s,%s,%s,'CREATED',%s,%s,%s,%s,%s,%s)",
            (
                job_id,
                owner,
                ip,
                request.tool,
                Jsonb(
                    request.options.model_dump(
                        include={"language", "cleanup"}
                        if request.tool in {"image-to-text", "pdf-to-text", "ocr-pdf"}
                        else {"behavior"}
                    )
                ),
                fingerprint,
                key,
                size,
                expiry,
                upload_expiry,
            ),
        )
        source_type = "application/octet-stream"
        if request.tool == "image-to-text":
            source_type = (
                "image/png" if request.files[0].name.lower().endswith(".png") else "image/jpeg"
            )
        db.execute(
            "INSERT INTO job_files(id,job_id,role,object_key,media_type,bytes,expires_at) VALUES (%s,%s,'upload',%s,%s,%s,%s)",
            (uuid4(), job_id, storage.object_key("upload"), source_type, size, expiry),
        )
        job = db.execute(
            "UPDATE conversion_jobs SET state='UPLOADING' WHERE id=%s RETURNING *", (job_id,)
        ).fetchone()
        return created_response(db, job)


def finalize(job_id, owner):
    error = None
    with connect() as db:
        job = owned(db, job_id, owner)
        usable(job)
        require_conversion(job["capability"])
        if job["state"] in ("QUEUED", "PROCESSING", "COMPLETED"):
            return {"state": job["state"]}
        if job["upload_expires_at"] <= now():
            fail("JOB_EXPIRED", "The upload window has expired.", 410)
        db.execute("UPDATE conversion_jobs SET state='VALIDATING' WHERE id=%s", (job_id,))
        uploaded = db.execute(
            "SELECT * FROM job_files WHERE job_id=%s AND role='upload'", (job_id,)
        ).fetchone()
        native = job["capability"] != "__fixture__"
        data = storage.read(
            uploaded["object_key"], 25 * 1024 * 1024 if native else settings.max_bytes
        )
        # A bounded byte snapshot prevents later presigned-PUT replay from changing worker input.
        capability = get_capability(job["capability"], require_enabled=False) if native else None
        signature = (
            (b"PK\x03\x04" if capability.family == "office" else b"%PDF-")
            if native
            else b"%FN-FIXTURE\n"
        )
        signature_valid = data.startswith(signature)
        if native and job["capability"] == "image-to-text":
            expected = (
                b"\x89PNG\r\n\x1a\n" if uploaded["media_type"] == "image/png" else b"\xff\xd8\xff"
            )
            signature_valid = data.startswith(expected) and len(data) <= 10 * 1024 * 1024
        if native and capability.family == "html":
            try:
                signature_valid = (
                    b"<" in data[:1024] and b"\x00" not in data and len(data) <= 2 * 1024 * 1024
                )
                data.decode("utf-8-sig")
            except UnicodeError:
                signature_valid = False
        if job["capability"] in PHASE11_TOOLS:
            signature_valid = phase11_signature(data, capability.extension)
        if len(data) != job["source_bytes"] or not signature_valid:
            error = "CORRUPT_FILE"
            db.execute(
                "UPDATE conversion_jobs SET state='FAILED',error_code=%s,cleanup_after=now(),completed_at=now() WHERE id=%s",
                (error, job_id),
            )
        else:
            key = storage.object_key("input")
            checksum = storage.write(key, data)
            db.execute(
                "INSERT INTO job_files(id,job_id,role,object_key,media_type,bytes,checksum,expires_at) VALUES (%s,%s,'input',%s,'application/octet-stream',%s,%s,%s)",
                (uuid4(), job_id, key, len(data), checksum, job["expires_at"]),
            )
            db.execute(
                "UPDATE conversion_jobs SET state='QUEUED',dispatch_at=now() WHERE id=%s", (job_id,)
            )
    if error:
        fail(error, "Uploaded content does not match the supported fixture format.")
    return {"state": "QUEUED"}


def status(job_id, owner):
    with connect() as db:
        job = owned(db, job_id, owner)
        expired = job["deleted_at"] is not None or job["expires_at"] <= now()
        files = []
        if job["state"] == "COMPLETED" and not expired:
            files = [
                {"fileId": str(f["id"]), "bytes": f["bytes"], "mediaType": f["media_type"]}
                for f in db.execute(
                    "SELECT * FROM job_files WHERE job_id=%s AND role='output' AND purged_at IS NULL",
                    (job_id,),
                ).fetchall()
            ]
        return {
            "jobId": str(job_id),
            "state": "EXPIRED" if expired else job["state"],
            "expiresAt": job["expires_at"].isoformat(),
            "progress": 100 if files else None,
            "error": job["error_code"],
            "files": files,
        }


def cancel(job_id, owner, delete=False):
    with connect() as db:
        job = owned(db, job_id, owner)
        if delete:
            db.execute(
                "UPDATE conversion_jobs SET deleted_at=COALESCE(deleted_at,now()),state='EXPIRED',cleanup_after=now() WHERE id=%s",
                (job_id,),
            )
        elif job["state"] in ACTIVE:
            db.execute(
                "UPDATE conversion_jobs SET state='CANCELLED',completed_at=now(),cleanup_after=now() WHERE id=%s",
                (job_id,),
            )
    return {"state": "EXPIRED" if delete else status(job_id, owner)["state"]}


def download(job_id, owner, file_id):
    with connect() as db:
        job = owned(db, job_id, owner)
        usable(job)
        if job["state"] != "COMPLETED":
            fail("JOB_UNAVAILABLE", "Output is not ready.", 409)
        file = db.execute(
            "SELECT * FROM job_files WHERE id=%s AND job_id=%s AND role='output' AND purged_at IS NULL",
            (file_id, job_id),
        ).fetchone()
        if not file:
            fail("NOT_AUTHORIZED", "Output is unavailable.", 404)
        ttl = min(60, int((job["expires_at"] - now()).total_seconds()))
        if ttl < 1:
            fail("JOB_EXPIRED", "Output expired.", 410)
        filename = "fixture-result.bin"
        if job["capability"] != "__fixture__":
            capability = get_capability(job["capability"], require_enabled=False)
            filename = job["capability"] + "-result." + capability.output_extension
        return {
            "url": storage.sign_download(file["object_key"], ttl, filename, file["media_type"]),
            "expiresIn": ttl,
        }

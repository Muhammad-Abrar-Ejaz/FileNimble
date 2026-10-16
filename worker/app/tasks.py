from phase11_policy import TOOLS as PHASE11_TOOLS, signature_valid as phase11_signature
import base64
import hashlib
import json
import logging
import time
from datetime import timedelta
from uuid import uuid4

import httpx
from celery import Celery
from celery.signals import heartbeat_sent

from app import storage
from app.capabilities import CAPABILITIES, get_capability
from app.config import settings
from app.db import connect, counter, heartbeat
from app.jobs import now
from app.production_policy import conversion_error

celery = Celery("filenimble", broker=settings.redis)
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    broker_connection_timeout=2,
    broker_transport_options={
        "visibility_timeout": 30,
        "socket_timeout": 2,
        "socket_connect_timeout": 2,
    },
    task_publish_retry=False,
    task_soft_time_limit=155,
    task_time_limit=165,
)


@heartbeat_sent.connect
def worker_heartbeat(**kwargs):
    try:
        heartbeat("worker")
    except Exception:
        logging.getLogger("worker").warning("worker_heartbeat_unavailable")


def runner(method, path, **kwargs):
    response = httpx.request(
        method,
        settings.runner_url + path,
        headers={"x-runner-key": settings.runner_secret},
        timeout=5,
        **kwargs,
    )
    response.raise_for_status()
    return response.json()


def renew(job_id, run_id):
    with connect() as db:
        return (
            db.execute(
                "UPDATE conversion_jobs SET lease_until=now()+(%s * interval '1 second') WHERE id=%s AND run_id=%s AND state='PROCESSING' AND deleted_at IS NULL AND expires_at>now() AND lease_until>now() RETURNING id",
                (settings.lease_seconds, job_id, run_id),
            ).fetchone()
            is not None
        )


def finish_failure(job_id, run_id, code):
    with connect() as db:
        job = db.execute(
            "SELECT * FROM conversion_jobs WHERE id=%s FOR UPDATE", (job_id,)
        ).fetchone()
        if (
            not job
            or str(job["run_id"]) != run_id
            or job["state"] != "PROCESSING"
            or job["deleted_at"]
            or job["expires_at"] <= now()
        ):
            return
        retry = code == "SERVICE_UNAVAILABLE" and job["attempts"] < settings.max_attempts
        db.execute(
            "UPDATE conversion_jobs SET state=%s,error_code=%s,dispatch_at=%s,dispatched_at=NULL,lease_until=NULL,completed_at=%s,cleanup_after=%s WHERE id=%s",
            (
                "QUEUED" if retry else "FAILED",
                None if retry else code,
                now() + timedelta(seconds=2 ** job["attempts"]) if retry else None,
                None if retry else now(),
                None if retry else now(),
                job_id,
            ),
        )
        db.execute(
            "UPDATE job_attempts SET finished_at=now(),outcome=%s,error_code=%s WHERE run_id=%s",
            ("retry" if retry else "failed", code, run_id),
        )
    counter("retries" if retry else code.lower())


@celery.task(name="filenimble.process")
def process(job_id):
    settings.validate()
    if (
        not settings.fixture
        and not settings.native_test
        and not any(capability.enabled for capability in CAPABILITIES.values())
    ):
        return
    run_id = str(uuid4())
    with connect() as db:
        job = db.execute(
            "SELECT * FROM conversion_jobs WHERE id=%s FOR UPDATE", (job_id,)
        ).fetchone()
        if (
            not job
            or job["state"] != "QUEUED"
            or job["deleted_at"]
            or job["expires_at"] <= now()
            or job["attempts"] >= settings.max_attempts
            or job["dispatch_at"] > now()
        ):
            return
        capability = CAPABILITIES.get(job["capability"])
        allowed = (
            (settings.fixture and settings.environment == "test")
            if job["capability"] == "__fixture__"
            else capability is not None and (capability.enabled or settings.native_test)
        )
        policy_error = conversion_error(job["capability"], settings)
        if not allowed or policy_error:
            db.execute(
                "UPDATE conversion_jobs SET state='FAILED',error_code=%s,cleanup_after=now(),completed_at=now() WHERE id=%s",
                (policy_error or "UNSUPPORTED_FORMAT", job_id),
            )
            return
        db.execute(
            "UPDATE conversion_jobs SET state='PROCESSING',attempts=attempts+1,run_id=%s,lease_until=now()+(%s * interval '1 second'),started_at=COALESCE(started_at,now()),worker_version=%s WHERE id=%s",
            (
                run_id,
                settings.lease_seconds,
                "tesseract-5.5.0-eng-v1"
                if job["capability"] in {"image-to-text", "pdf-to-text", "ocr-pdf"}
                else "phase11-archive-v1"
                if capability is not None and capability.family == "archive"
                else "phase5-fixture-v1",
                job_id,
            ),
        )
        db.execute("INSERT INTO job_attempts(run_id,job_id) VALUES (%s,%s)", (run_id, job_id))
        source = db.execute(
            "SELECT * FROM job_files WHERE job_id=%s AND role='input'", (job_id,)
        ).fetchone()
    output_key = None
    native = job["capability"] != "__fixture__"
    run_path = f"/native/{run_id}" if native else f"/runs/{run_id}"
    try:
        heartbeat("worker")
        data = storage.read(
            source["object_key"], 25 * 1024 * 1024 if native else settings.max_bytes
        )
        if hashlib.sha256(data).hexdigest() != source["checksum"]:
            finish_failure(job_id, run_id, "CORRUPT_FILE")
            return
        if native:
            params = (
                job["options"]
                if job["capability"] in {"image-to-text", "pdf-to-text", "ocr-pdf"}
                else None
            )
            runner("POST", run_path + "/" + job["capability"], content=data, params=params)
        else:
            runner(
                "POST",
                "/runs",
                json={
                    "run_id": run_id,
                    "data": base64.b64encode(data).decode(),
                    "options": job["options"],
                },
            )
        deadline = time.monotonic() + (130 if native else 20)
        while time.monotonic() < deadline:
            if not renew(job_id, run_id):
                runner("DELETE", run_path)
                return
            heartbeat("worker")
            result = runner("GET", run_path)
            if result["done"]:
                break
            time.sleep(0.3)
        else:
            runner("DELETE", run_path)
            finish_failure(job_id, run_id, "CONVERSION_TIMEOUT")
            return
        if result.get("error"):
            finish_failure(job_id, run_id, result["error"])
            return
        if native:
            output = bytearray()
            with httpx.stream(
                "GET",
                settings.runner_url + run_path + "/output",
                headers={"x-runner-key": settings.runner_secret},
                timeout=10,
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes(65536):
                    output.extend(chunk)
                    if len(output) > 100 * 1024 * 1024:
                        raise ValueError("RESOURCE_LIMIT")
            capability = get_capability(job["capability"], require_enabled=False)
            signature = (
                b"\xef\xbb\xbf"
                if capability.output_extension == "txt"
                else b"%PDF-"
                if capability.output_extension == "pdf"
                else b"PK\x03\x04"
            )
            valid = (
                phase11_signature(output, capability.output_extension)
                if job["capability"] in PHASE11_TOOLS
                else output.startswith(signature)
            ) and len(output) == result["metadata"]["size"]
        else:
            output = base64.b64decode(result["output"], validate=True)
            valid = len(output) <= settings.max_bytes
        if not native and job["options"]["behavior"] == "probe":
            valid = valid and isinstance(json.loads(output), dict)
        elif not native:
            valid = valid and output == b"%FN-RESULT\n" + data[len(b"%FN-FIXTURE\n") :].upper()
        if not valid:
            finish_failure(job_id, run_id, "INVALID_OUTPUT")
            return
        output_key = storage.object_key("output")
        checksum = storage.write(output_key, output)
        with connect() as db:
            current = db.execute(
                "SELECT * FROM conversion_jobs WHERE id=%s FOR UPDATE", (job_id,)
            ).fetchone()
            if (
                current["state"] != "PROCESSING"
                or str(current["run_id"]) != run_id
                or current["deleted_at"]
                or current["expires_at"] <= now()
                or current["lease_until"] <= now()
            ):
                storage.remove(output_key)
                return
            expiry = now() + timedelta(seconds=settings.retention)
            db.execute(
                "INSERT INTO job_files(id,job_id,role,object_key,media_type,bytes,checksum,expires_at) VALUES (%s,%s,'output',%s,%s,%s,%s,%s)",
                (
                    uuid4(),
                    job_id,
                    output_key,
                    result["metadata"]["mediaType"] if native else "application/octet-stream",
                    len(output),
                    checksum,
                    expiry,
                ),
            )
            db.execute(
                "UPDATE conversion_jobs SET state='COMPLETED',output_bytes=%s,completed_at=now(),expires_at=%s,lease_until=NULL WHERE id=%s",
                (len(output), expiry, job_id),
            )
            db.execute(
                "UPDATE job_attempts SET finished_at=now(),outcome='completed' WHERE run_id=%s",
                (run_id,),
            )
        counter("completed")
    except Exception:
        finish_failure(job_id, run_id, "SERVICE_UNAVAILABLE")
    finally:
        try:
            runner("DELETE", run_path)
        except Exception:
            logging.getLogger("worker").warning("runner_cancel_unavailable")

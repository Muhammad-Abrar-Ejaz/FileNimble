"""Disposable production-mode stack only: real queue, S3, gateway and native Docker.

Never run against a live service: explicit harness flag and unique namespace required.
"""

import io
import os
import time
import tarfile
import zipfile
from dataclasses import replace
from uuid import uuid4

import httpx
import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException

from app import jobs, lifecycle, storage, tasks
from app.config import settings
from app.db import connect
from app.security import issue_session
from phase11_fixtures import archive

pytestmark = [pytest.mark.integration, pytest.mark.production_integration]


@pytest.fixture(autouse=True)
def isolated_only():
    assert os.getenv("PHASE15_DISPOSABLE") == "1"
    assert os.getenv("RUNNER_NAMESPACE", "").startswith("phase15-qualification-")
    assert settings.environment == "production"
    assert settings.production_tool_allowlist == "tar-to-zip,zip-to-tar"


def client():
    c = httpx.Client(
        base_url="http://api:8000",
        timeout=10,
        headers={"x-internal-key": settings.internal_secret, "x-client-ip": str(uuid4())},
    )
    # Production cookies are Secure. The private no-ingress harness uses plain HTTP;
    # supply an independently signed session instead of relaxing cookie security.
    c.cookies.set("fn_session", issue_session())
    return c


def create(c, slug, data):
    extension = "tar" if slug == "tar-to-zip" else "zip"
    response = c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": slug,
            "files": [
                {
                    "name": "owned." + extension,
                    "size": len(data),
                    "type": "application/x-tar" if extension == "tar" else "application/zip",
                }
            ],
        },
    )
    assert response.status_code == 201
    return response.json()


def transfer(url, method, data=None):
    # Public TLS routing is a separate live foundation gate. This network has no ingress.
    assert url.startswith(settings.transfer_public + "/transfers/")
    path = url[len(settings.transfer_public) :]
    return httpx.request(
        method,
        "http://transfers:8002" + path,
        content=data,
        timeout=15,
        headers={"origin": settings.site_origin, "content-type": "application/octet-stream"},
    )


def wait(c, job, target="COMPLETED"):
    deadline = time.monotonic() + 45
    last_status = None
    while time.monotonic() < deadline:
        result = c.get("/api/v1/jobs/" + job["jobId"])
        assert result.status_code == 200
        status = result.json()
        last_status = status
        if status["state"] == target:
            return status
        if status["state"] in {"FAILED", "EXPIRED", "CANCELLED"}:
            pytest.fail(
                f"archive job ended in {status['state']} with code={status.get('error') or 'none'}"
            )
        time.sleep(0.2)
    pytest.fail(
        "archive job timed out waiting for completion "
        f"state={last_status['state']} code={last_status.get('error') or 'none'}"
    )


def members(data, extension):
    if extension == "zip":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return [(x.filename.rstrip("/"), x.is_dir(), z.read(x)) for x in z.infolist()]
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as z:
        return [(x.name, x.isdir(), b"" if x.isdir() else z.extractfile(x).read()) for x in z]


@pytest.mark.parametrize("source,target", [("tar", "zip"), ("zip", "tar")])
def test_real_production_archive_download_freeze_owner_delete_cleanup(source, target):
    data = archive(source)
    with client() as c, client() as other:
        other.cookies.set("fn_session", issue_session())
        job = create(c, source + "-to-" + target, data)
        path = "/api/v1/jobs/" + job["jobId"]
        assert other.get(path).status_code == 404
        assert transfer(job["uploads"][0]["url"], "PUT", data).status_code == 204
        assert c.post(path + "/complete-upload").status_code == 200
        # Replay cannot replace the frozen object used by the asynchronous worker.
        assert transfer(job["uploads"][0]["url"], "PUT", b"x" * len(data)).status_code == 204
        status = wait(c, job)
        file_id = status["files"][0]["fileId"]
        assert other.post(path + "/download-token", json={"fileId": file_id}).status_code == 404
        response = c.post(path + "/download-token", json={"fileId": file_id})
        assert response.status_code == 200
        downloaded = transfer(response.json()["url"], "GET")
        assert downloaded.status_code == 200
        assert members(downloaded.content, target) == members(data, source)
        assert downloaded.headers["content-disposition"].endswith(
            f'filename="{source}-to-{target}-result.{target}"'
        )
        assert downloaded.headers["cache-control"] == "no-store"
        assert c.delete(path).status_code == 200
        assert c.post(path + "/download-token", json={"fileId": file_id}).status_code != 200
        lifecycle.cleanup()
        assert transfer(response.json()["url"], "GET").status_code == 404
        with connect() as db:
            keys = [
                f["object_key"]
                for f in db.execute(
                    "SELECT object_key FROM job_files WHERE job_id=%s", (job["jobId"],)
                )
            ]
        for key in keys:
            with pytest.raises(ClientError) as error:
                storage.client().head_object(Bucket=settings.bucket, Key=key)
            assert error.value.response["ResponseMetadata"]["HTTPStatusCode"] == 404


def test_admission_excludes_ocr_audio_and_unlicensed_tools():
    with client() as c:
        for slug, extension, mime in [
            ("image-to-text", "png", "image/png"),
            ("wav-to-flac", "wav", "audio/wav"),
            (
                "word-to-pdf",
                "docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        ]:
            response = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": slug,
                    "files": [{"name": "owned." + extension, "size": 100, "type": mime}],
                },
            )
            assert response.status_code == 400
            assert response.json()["error"] == "UNSUPPORTED_FORMAT"


def test_finalize_revocation_and_worker_persisted_job_recheck(monkeypatch):
    data = archive("tar")
    with client() as c:
        job = create(c, "tar-to-zip", data)
        assert transfer(job["uploads"][0]["url"], "PUT", data).status_code == 204
        with connect() as db:
            owner = db.execute(
                "SELECT owner_hash FROM conversion_jobs WHERE id=%s", (job["jobId"],)
            ).fetchone()["owner_hash"]
        monkeypatch.setattr(jobs, "settings", replace(settings, production_tool_allowlist=""))
        with pytest.raises(HTTPException) as error:
            jobs.finalize(job["jobId"], owner)
        assert error.value.detail["error"] == "UNSUPPORTED_FORMAT"
        with connect() as db:
            assert (
                db.execute(
                    "SELECT state FROM conversion_jobs WHERE id=%s", (job["jobId"],)
                ).fetchone()["state"]
                == "UPLOADING"
            )
            # Old/injected queued work must fail without reading a source or calling a worker.
            db.execute(
                "UPDATE conversion_jobs SET state='QUEUED',capability='ocr-pdf',dispatch_at=now() WHERE id=%s",
                (job["jobId"],),
            )
        tasks.process.run(job["jobId"])
        with connect() as db:
            row = db.execute(
                "SELECT state,error_code,attempts FROM conversion_jobs WHERE id=%s", (job["jobId"],)
            ).fetchone()
        assert row == {"state": "FAILED", "error_code": "UNSUPPORTED_FORMAT", "attempts": 0}
        c.delete("/api/v1/jobs/" + job["jobId"])
        lifecycle.cleanup()


def test_expiry_grants_and_lifecycle_delete_actual_objects():
    data = archive("zip")
    with client() as c:
        job = create(c, "zip-to-tar", data)
        assert transfer(job["uploads"][0]["url"], "PUT", data).status_code == 204
        assert c.post("/api/v1/jobs/" + job["jobId"] + "/complete-upload").status_code == 200
        wait(c, job)
        with connect() as db:
            db.execute(
                "UPDATE conversion_jobs SET expires_at=now()-interval '1 second',upload_expires_at=now()-interval '1 second' WHERE id=%s",
                (job["jobId"],),
            )
        lifecycle.cleanup()
        response = c.get("/api/v1/jobs/" + job["jobId"])
        assert response.json()["state"] == "EXPIRED" and response.json()["files"] == []
        with connect() as db:
            assert (
                db.execute(
                    "SELECT count(*) AS n FROM job_files WHERE job_id=%s AND purged_at IS NULL",
                    (job["jobId"],),
                ).fetchone()["n"]
                == 0
            )

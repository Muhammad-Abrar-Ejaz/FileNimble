"""Operator-only HTTPS smoke test using generated fixtures; never prints credentials or URLs.

Run inside the API service after host/TLS checks. --job additionally exercises a released
archive worker and actual lifecycle expiry; it requires prior ARM64 qualification/activation.
No HTTP endpoint exposes this diagnostic.
"""

import io
import sys
import tarfile
import time
import zipfile
from uuid import uuid4

import httpx
from botocore.exceptions import ClientError

from app import storage
from app.config import settings
from app.transfer_tokens import signing_secret


def fixture():
    content = b"FileNimble generated deployment fixture\n"
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        info = tarfile.TarInfo("notes/owned.txt")
        info.size = len(content)
        archive.addfile(info, io.BytesIO(content))
    return output.getvalue(), content


def absent(key):
    try:
        storage.client().head_object(Bucket=settings.bucket, Key=key)
    except ClientError as error:
        assert error.response["ResponseMetadata"]["HTTPStatusCode"] == 404
        return
    raise AssertionError("Fixture object was not deleted")


def transfers_check():
    raw, content = fixture()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("notes/owned.txt", content)
    upload, result = storage.object_key("upload"), storage.object_key("output")
    origin = {"Origin": settings.site_origin}
    with httpx.Client(timeout=70, trust_env=False, follow_redirects=False) as client:
        assert client.get(settings.transfer_public + "/health").status_code == 200
        assert client.get(settings.transfer_public + "/api/v1/tools").status_code == 401
        try:
            url = storage.sign_upload(upload, 120, len(raw))
            assert (
                client.options(
                    url,
                    headers=origin
                    | {
                        "Access-Control-Request-Method": "PUT",
                        "Access-Control-Request-Headers": "content-type",
                    },
                ).status_code
                == 204
            )
            headers = origin | {"Content-Type": "application/octet-stream"}
            assert client.put(url, content=b"wrong length", headers=headers).status_code == 413
            assert (
                client.put(
                    url, content=raw, headers=headers | {"Origin": "https://untrusted.example"}
                ).status_code
                == 403
            )
            assert client.put(url, content=raw, headers=headers).status_code == 204
            assert storage.read(upload, len(raw)) == raw
            storage.write(result, output.getvalue())
            download = storage.sign_download(result, 120, "owned-result.zip", "application/zip")
            response = client.get(download, headers=origin)
            assert (
                response.status_code == 200
                and response.headers["Access-Control-Allow-Origin"] == settings.site_origin
            )
            assert response.headers["Cache-Control"] == "no-store"
            with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                assert archive.read("notes/owned.txt") == content
            expired = storage.sign_download(result, 1, "owned-result.zip", "application/zip")
            time.sleep(2)
            assert client.get(expired).status_code == 403
            storage.remove(result)
            absent(result)
            assert client.get(download).status_code == 404
        finally:
            storage.remove(upload)
            storage.remove(result)
        absent(upload)
        absent(result)
    print(
        "PASS: HTTPS authentication, scoped transfers, CORS, exact size, valid download, expiry and deletion."
    )


def job_check():
    from app.db import connect
    from app.lifecycle import cleanup
    from app.security import issue_session

    assert settings.production_conversions, "ARM64 converters have not been enabled"
    raw, content = fixture()
    headers = {"x-internal-key": settings.internal_secret, "x-client-ip": "127.0.0.1"}
    job_id = None
    with (
        httpx.Client(
            base_url=settings.transfer_public,
            headers=headers,
            timeout=70,
            trust_env=False,
            follow_redirects=False,
        ) as client,
        httpx.Client(timeout=70, trust_env=False, follow_redirects=False) as transfer_client,
    ):
        try:
            response = client.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "tar-to-zip",
                    "files": [{"name": "owned.tar", "size": len(raw), "type": "application/x-tar"}],
                },
            )
            assert response.status_code == 201
            job = response.json()
            job_id = job["jobId"]
            with httpx.Client(
                base_url=settings.transfer_public, headers=headers, timeout=10, trust_env=False
            ) as other:
                other.cookies.set("fn_session", issue_session())
                assert other.get("/api/v1/jobs/" + job_id).status_code == 404
            upload = job["uploads"][0]
            assert (
                transfer_client.put(
                    upload["url"],
                    content=raw,
                    headers=upload["headers"] | {"Origin": settings.site_origin},
                ).status_code
                == 204
            )
            assert client.post(f"/api/v1/jobs/{job_id}/complete-upload").status_code == 200
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                response = client.get("/api/v1/jobs/" + job_id)
                assert response.status_code == 200
                status = response.json()
                if status["state"] in {"COMPLETED", "FAILED", "EXPIRED", "CANCELLED"}:
                    break
                time.sleep(1)
            assert status["state"] == "COMPLETED"
            token = client.post(
                f"/api/v1/jobs/{job_id}/download-token",
                json={"fileId": status["files"][0]["fileId"]},
            )
            assert token.status_code == 200
            download = token.json()["url"]
            result = transfer_client.get(download)
            assert result.status_code == 200
            with zipfile.ZipFile(io.BytesIO(result.content)) as archive:
                assert archive.read("notes/owned.txt") == content
            # Only this generated diagnostic job is expired; no unrelated job is changed.
            with connect() as db:
                keys = db.execute(
                    "SELECT object_key FROM job_files WHERE job_id=%s", (job_id,)
                ).fetchall()
                db.execute(
                    "UPDATE conversion_jobs SET expires_at=now(),upload_expires_at=now() WHERE id=%s",
                    (job_id,),
                )
            cleanup()
            for item in keys:
                absent(item["object_key"])
            assert transfer_client.get(download).status_code == 404
        finally:
            if job_id:
                client.delete("/api/v1/jobs/" + job_id)
    print(
        "PASS: frozen input, isolated archive job, actual ZIP content, ownership and lifecycle purge."
    )


def main():
    if sys.flags.optimize:
        raise RuntimeError("Diagnostics require Python assertions enabled")
    assert settings.environment == "production"
    settings.validate()
    signing_secret()
    transfers_check()
    if "--job" in sys.argv:
        job_check()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # HTTP exception representations can contain signed URLs. Keep operator output safe.
        print(
            "FAIL: Oracle smoke check; review private service health/configuration. No credentials printed."
        )
        sys.exit(1)

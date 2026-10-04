"""Actual signed storage, queue, disposable workers, ownership and downloads."""

import io
import zipfile
from dataclasses import replace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.config import settings
from app.security import issue_session
from phase11_fixtures import archive, audio
from phase11_policy import TOOLS, signature_valid
from qualify_office import qualify
from test_phase11_engines import webm
from test_integration import client, download, finalize, upload, wait

pytestmark = pytest.mark.integration

RELEASED_TOOLS = ["wav-to-flac", "flac-to-wav", "tar-to-zip", "zip-to-tar"]


def create(c, slug, data):
    spec = TOOLS[slug]
    response = c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": slug,
            "files": [{"name": "fixture." + spec[1], "size": len(data), "type": spec[2]}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("slug", RELEASED_TOOLS)
def test_phase11_real_job_download_and_owner(slug):
    if not settings.native_test:
        pytest.skip("Explicit qualification stack required")
    extension = TOOLS[slug][1]
    if extension == "wav":
        data = audio()
    elif extension == "flac":
        data = qualify("256m", "wav-to-flac", audio(), "media")
    elif extension == "webm":
        data = webm()
    else:
        data = archive(extension)
    with client() as c, client() as other:
        other.cookies.set("fn_session", issue_session())
        job = create(c, slug, data)
        assert other.get(f"/api/v1/jobs/{job['jobId']}").status_code == 404
        upload(job, data)
        finalize(c, job)
        status = wait(c, job)
        output = download(c, job, status)
        assert signature_valid(output, TOOLS[slug][3]) and output != data
        if slug == "tar-to-zip":
            with zipfile.ZipFile(io.BytesIO(output)) as result:
                assert result.read("notes/one.txt") == b"FileNimble first file\n"
        assert (
            other.post(
                f"/api/v1/jobs/{job['jobId']}/download-token",
                json={"fileId": status["files"][0]["fileId"]},
            ).status_code
            == 404
        )
        assert c.delete(f"/api/v1/jobs/{job['jobId']}").status_code == 200
        assert (
            c.post(
                f"/api/v1/jobs/{job['jobId']}/download-token",
                json={"fileId": status["files"][0]["fileId"]},
            ).status_code
            != 200
        )


def test_phase11_cancel_fences_output_and_rejects_spoofed_signature():
    with client() as c:
        data = archive()
        job = create(c, "zip-to-tar", data)
        upload(job, data)
        assert c.post(f"/api/v1/jobs/{job['jobId']}/cancel").status_code == 200
        assert c.get(f"/api/v1/jobs/{job['jobId']}").json()["files"] == []
        c.delete(f"/api/v1/jobs/{job['jobId']}")
        job = create(c, "zip-to-tar", b"spoofed archive")
        upload(job, b"spoofed archive")
        assert c.post(f"/api/v1/jobs/{job['jobId']}/complete-upload").status_code == 400
        c.delete(f"/api/v1/jobs/{job['jobId']}")


@pytest.mark.parametrize("slug", ["video-mute", "video-to-wav", "video-to-frames"])
def test_unlicensed_video_capabilities_are_not_publicly_activatable(slug, monkeypatch):
    # The native qualification overlay permits direct testing of disabled media
    # workers. Disable that test-only exception to exercise production admission.
    import app.jobs as jobs
    from app.schemas import CreateJob, SourceFile

    monkeypatch.setattr(jobs, "settings", replace(settings, native_test=False))
    assert jobs.settings.native_test is False
    request = CreateJob(
        tool=slug,
        files=[SourceFile(name="fixture.webm", size=100, type="video/webm")],
    )
    with pytest.raises(HTTPException) as error:
        jobs.create(request, "owner", "127.0.0.1", str(uuid4()))
    assert error.value.status_code == 400
    assert error.value.detail["error"] == "UNSUPPORTED_FORMAT"

"""Real OCR jobs through the existing platform, with private temporary content."""

import io
from uuid import uuid4

import pytest
from pypdf import PdfReader
from pydantic import ValidationError

from app.db import connect
from app.lifecycle import cleanup
from app.schemas import CreateJob
from ocr_fixtures import png, scanned_pdf
from test_integration import client, download, finalize, upload, wait


def create_ocr(c, tool, data, extension):
    response = c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": tool,
            "files": [
                {
                    "name": "owned." + extension,
                    "size": len(data),
                    "type": "image/png" if extension == "png" else "application/pdf",
                }
            ],
            "options": {"language": "eng", "cleanup": True},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("tool", ["image-to-text", "pdf-to-text", "ocr-pdf"])
def test_ocr_real_download_and_deletion(tool):
    data = png() if tool == "image-to-text" else scanned_pdf()
    with client() as c, client() as other:
        job = create_ocr(c, tool, data, "png" if tool == "image-to-text" else "pdf")
        upload(job, data)
        finalize(c, job)
        result = wait(c, job, timeout=140)
        content = download(c, job, result)
        if tool == "ocr-pdf":
            reader = PdfReader(io.BytesIO(content), strict=True)
            assert len(reader.pages) == 2
            assert (
                "ALPHA" in reader.pages[0].extract_text()
                and "BETA" in reader.pages[1].extract_text()
            )
        else:
            assert "4827" in content.decode("utf-8-sig")
        assert other.get("/api/v1/jobs/" + job["jobId"]).status_code in (401, 404)
        assert c.delete("/api/v1/jobs/" + job["jobId"]).status_code == 200
        assert (
            c.post(
                "/api/v1/jobs/" + job["jobId"] + "/download-token",
                json={"fileId": result["files"][0]["fileId"]},
            ).status_code
            == 410
        )
        with connect() as db:
            db.execute(
                "UPDATE conversion_jobs SET upload_expires_at=now() WHERE id=%s", (job["jobId"],)
            )
        cleanup()
        with connect() as db:
            assert (
                db.execute(
                    "SELECT count(*) AS n FROM job_files WHERE job_id=%s AND purged_at IS NULL",
                    (job["jobId"],),
                ).fetchone()["n"]
                == 0
            )


def test_ocr_cancel_and_concurrent_limit():
    data = scanned_pdf()
    with client() as c:
        job = create_ocr(c, "ocr-pdf", data, "pdf")
        duplicate = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "tool": "ocr-pdf",
                "files": [{"name": "second.pdf", "size": len(data), "type": "application/pdf"}],
            },
        )
        assert duplicate.status_code == 429
        upload(job, data)
        finalize(c, job)
        assert c.post("/api/v1/jobs/" + job["jobId"] + "/cancel").status_code == 200
        state = wait(c, job, state="CANCELLED")
        assert state["files"] == []


def test_spoofed_image_extension_is_rejected():
    data = b"\xff\xd8\xffnot-a-png"
    with client() as c:
        job = create_ocr(c, "image-to-text", data, "png")
        upload(job, data)
        assert c.post("/api/v1/jobs/" + job["jobId"] + "/complete-upload").status_code == 400


@pytest.mark.parametrize(
    "options,size",
    [
        ({"language": "fra"}, 100),
        ({"cleanup": "yes"}, 100),
        ({"behavior": "normal"}, 100),
        ({"language": "eng"}, 10 * 1024 * 1024 + 1),
        ({"command": "cat"}, 100),
    ],
)
def test_ocr_strict_schema(options, size):
    with pytest.raises(ValidationError):
        CreateJob.model_validate(
            {
                "tool": "image-to-text",
                "files": [{"name": "owned.png", "size": size, "type": "image/png"}],
                "options": options,
            }
        )

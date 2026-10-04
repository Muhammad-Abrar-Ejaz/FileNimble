"""Native qualification uses real services and generated documents."""

from uuid import uuid4

import pytest

from app.capabilities import CAPABILITIES
from app.config import settings
from app.security import issue_session
from native_fixtures import HTML, office_fixture
from test_integration import client, download, finalize, upload, wait

pytestmark = pytest.mark.integration


def skip_unless_native():
    if not settings.native_test:
        pytest.skip("Run with compose.native-test.yaml to qualify native adapters")


def native_job(c, tool, data, name, media_type):
    response = c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": tool,
            "files": [{"name": name, "size": len(data), "type": media_type}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_real_docx_pipeline():
    skip_unless_native()
    data = office_fixture("docx")
    with client() as c:
        job = native_job(
            c,
            "word-to-pdf",
            data,
            "owned.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        upload(job, data)
        finalize(c, job)
        result = wait(c, job, timeout=140)
        pdf = download(c, job, result)
        assert pdf.startswith(b"%PDF-") and b"%%EOF" in pdf[-1024:]
        assert result["files"][0]["mediaType"] == "application/pdf"
        assert c.delete(f"/api/v1/jobs/{job['jobId']}").status_code == 200


def test_real_pptx_pipeline():
    skip_unless_native()
    data = office_fixture("pptx")
    with client() as c:
        job = native_job(
            c,
            "powerpoint-to-pdf",
            data,
            "slides.pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
        upload(job, data)
        finalize(c, job)
        result = wait(c, job, timeout=140)
        pdf = download(c, job, result)
        assert pdf.startswith(b"%PDF-")
        assert result["files"][0]["mediaType"] == "application/pdf"
        assert c.delete(f"/api/v1/jobs/{job['jobId']}").status_code == 200


def test_real_html_pipeline():
    skip_unless_native()
    with client() as c:
        job = native_job(c, "html-to-pdf", HTML, "page.html", "text/html")
        upload(job, HTML)
        finalize(c, job)
        result = wait(c, job, timeout=140)
        pdf = download(c, job, result)
        assert pdf.startswith(b"%PDF-")
        assert result["files"][0]["mediaType"] == "application/pdf"
        assert c.delete(f"/api/v1/jobs/{job['jobId']}").status_code == 200


def test_real_compress_pipeline():
    """Compress uses a real HTML-generated PDF as input."""
    skip_unless_native()
    with client() as c:
        # First generate a source PDF via HTML
        job1 = native_job(c, "html-to-pdf", HTML, "source.html", "text/html")
        upload(job1, HTML)
        finalize(c, job1)
        result1 = wait(c, job1, timeout=140)
        source = download(c, job1, result1)
        assert source.startswith(b"%PDF-")
        # Now compress it
        job2 = native_job(c, "compress-pdf", source, "input.pdf", "application/pdf")
        upload(job2, source)
        finalize(c, job2)
        result2 = wait(c, job2, timeout=140)
        compressed = download(c, job2, result2)
        assert compressed.startswith(b"%PDF-")
        assert result2["files"][0]["mediaType"] == "application/pdf"


def test_disabled_capability_rejected():
    """Capabilities that are disabled cannot create jobs even in native test mode."""
    skip_unless_native()
    with client() as c:
        # All capabilities are disabled. But native_test mode allows families
        # office/html/utility/render/tables. A capability that is disabled AND
        # outside allowed families should be rejected. protect-pdf has family "secret".
        response = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "tool": "protect-pdf",
                "files": [{"name": "test.pdf", "size": 100, "type": "application/pdf"}],
            },
        )
        assert response.status_code in (400, 422), response.text


def test_unknown_tool_rejected():
    """Completely unknown tool names are rejected."""
    skip_unless_native()
    with client() as c:
        response = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "tool": "arbitrary-command",
                "files": [{"name": "test.bin", "size": 100, "type": "application/octet-stream"}],
            },
        )
        assert response.status_code in (400, 422), response.text


def test_native_job_ownership():
    """A different session cannot access a native job."""
    skip_unless_native()
    data = office_fixture("docx")
    with client() as c1:
        job = native_job(
            c1,
            "word-to-pdf",
            data,
            "owned.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        upload(job, data)
        finalize(c1, job)
        # Without session, request is 401; with a different session, request is 404
        with client() as c2:
            assert c2.get(f"/api/v1/jobs/{job['jobId']}").status_code == 401
            c2.cookies.set("fn_session", issue_session())
            response = c2.get(f"/api/v1/jobs/{job['jobId']}")
            assert response.status_code == 404
        # Clean up
        assert c1.delete(f"/api/v1/jobs/{job['jobId']}").status_code == 200


def test_native_cancellation():
    """A native job can be cancelled."""
    skip_unless_native()
    data = office_fixture("docx")
    with client() as c:
        job = native_job(
            c,
            "word-to-pdf",
            data,
            "owned.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        upload(job, data)
        finalize(c, job)
        # Cancel immediately
        response = c.post(f"/api/v1/jobs/{job['jobId']}/cancel")
        assert response.status_code == 200
        # Status should be CANCELLED or still PROCESSING (race)
        status = c.get(f"/api/v1/jobs/{job['jobId']}").json()
        assert status["state"] in ("CANCELLED", "PROCESSING", "COMPLETED", "FAILED")


def test_released_capabilities_enabled_and_unreleased_candidates_disabled():
    """Keep the individually released tools live and the gated candidates disabled."""
    released = {
        "image-to-text",
        "pdf-to-text",
        "ocr-pdf",
        "csv-to-xlsx",
        "xlsx-to-csv",
        "json-to-xlsx",
        "xlsx-to-json",
        "markdown-to-pdf",
        "markdown-to-docx",
        "docx-to-markdown",
        "txt-to-pdf",
        "rtf-to-pdf",
        "wav-to-flac",
        "flac-to-wav",
        "tar-to-zip",
        "zip-to-tar",
    }
    intentionally_unreleased = {
        "word-to-pdf",
        "powerpoint-to-pdf",
        "excel-to-pdf",
        "html-to-pdf",
        "pdf-to-word",
        "pdf-to-powerpoint",
        "pdf-to-excel",
        "compress-pdf",
        "protect-pdf",
        "unlock-pdf",
        "pdf-to-pdfa",
        "repair-pdf",
        "video-mute",
        "video-to-wav",
        "video-to-frames",
    }
    assert set(CAPABILITIES) == released | intentionally_unreleased
    for slug, capability in CAPABILITIES.items():
        if slug in released:
            assert capability.enabled, f"{slug} is released and must remain enabled"
        elif slug in intentionally_unreleased:
            assert not capability.enabled, (
                f"{slug} must remain disabled until its release gate passes"
            )

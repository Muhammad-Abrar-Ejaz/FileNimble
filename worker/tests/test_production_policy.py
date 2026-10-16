"""Fail-closed deployment boundaries; no credentials, Docker or network required."""

import asyncio
import threading
from contextlib import contextmanager
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import api, jobs, lifecycle, native_runner, tasks, transfer_tokens, transfers, storage
from app.capabilities import CAPABILITIES
from app.config import settings
from app.production_policy import RELEASE_SCOPE, conversion_error, parse_allowlist


def configured(allowlist="tar-to-zip,zip-to-tar", enabled=True):
    return replace(settings, environment="production", production_conversions=enabled,
                   production_tool_allowlist=allowlist, fixture=False, native_test=False,
                   secret="s" * 64, internal_secret="i" * 64, runner_secret="r" * 64,
                   transfer_public="https://backend.example.org",
                   site_origin="https://www.filenimble.app", s3_endpoint="http://storage:3900")


@pytest.mark.parametrize("value", ["*", "ocr-pdf", "image-to-text", "wav-to-flac",
                                   "word-to-pdf", "tar-to-zip,tar-to-zip",
                                   "tar-to-zip,", " tar-to-zip", "tar-to-zip, zip-to-tar",
                                   "TAR-to-ZIP", "x" * 257, None])
def test_invalid_scope_rejected(value):
    with pytest.raises(ValueError):
        parse_allowlist(value)
    with pytest.raises(RuntimeError):
        replace(configured(), production_tool_allowlist=value).validate()


def test_empty_scope_and_global_switch_are_independent():
    assert parse_allowlist("") == frozenset()
    assert conversion_error("tar-to-zip", configured("")) == "UNSUPPORTED_FORMAT"
    assert conversion_error("tar-to-zip", configured(enabled=False)) == "SERVICE_UNAVAILABLE"
    assert conversion_error("tar-to-zip", configured("tar-to-zip")) is None
    assert conversion_error("zip-to-tar", configured("tar-to-zip")) == "UNSUPPORTED_FORMAT"
    for tool in ["ocr-pdf", "image-to-text", "pdf-to-text", "wav-to-flac", "word-to-pdf",
                 "video-mute", "__fixture__", "unknown"]:
        assert conversion_error(tool, configured()) == "UNSUPPORTED_FORMAT"
    assert conversion_error("tar-to-zip", replace(configured(), environment="invalid"))
    assert conversion_error("__fixture__", replace(settings, environment="test", fixture=True)) is None
    assert conversion_error("wav-to-flac", replace(settings, environment="development")) is None


def test_production_source_scope_is_exactly_the_qualified_archive_pair():
    expected = frozenset({"tar-to-zip", "zip-to-tar"})
    assert RELEASE_SCOPE == expected
    assert parse_allowlist("tar-to-zip,zip-to-tar") == expected
    for tool in set(CAPABILITIES) | {"__fixture__", "unknown"}:
        assert (conversion_error(tool, configured()) is None) == (tool in expected)


def unexpected(*args, **kwargs):
    raise AssertionError("Rejected converter must not access downstream resources")


def test_admission_and_reissued_upload_reject_before_database_or_storage(monkeypatch):
    monkeypatch.setattr(jobs, "settings", configured(""))
    monkeypatch.setattr(jobs, "connect", unexpected)
    monkeypatch.setattr(storage, "sign_upload", unexpected)
    with pytest.raises(HTTPException) as error:
        jobs.create(SimpleNamespace(tool="tar-to-zip"), "owner", "ip", "key")
    assert error.value.status_code == 400
    with pytest.raises(HTTPException):
        jobs.created_response(None, {"state": "UPLOADING", "capability": "tar-to-zip"})


def test_emergency_stop_rejects_new_job_before_database_or_storage(monkeypatch):
    monkeypatch.setattr(jobs, "settings", configured(enabled=False))
    monkeypatch.setattr(jobs, "connect", unexpected)
    monkeypatch.setattr(storage, "sign_upload", unexpected)
    with pytest.raises(HTTPException) as error:
        jobs.create(SimpleNamespace(tool="tar-to-zip"), "owner", "ip", "key")
    assert error.value.status_code == 503
    assert error.value.detail["error"] == "SERVICE_UNAVAILABLE"


class Database:
    def __init__(self, job):
        self.job, self.calls = job, []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return self

    def fetchone(self):
        return self.job

    def fetchall(self):
        return [self.job]


def queued():
    return {"id": uuid4(), "capability": "ocr-pdf", "state": "QUEUED",
            "deleted_at": None, "expires_at": jobs.now() + timedelta(minutes=5),
            "attempts": 0, "dispatch_at": jobs.now() - timedelta(seconds=1)}


def install_db(monkeypatch, module, db):
    @contextmanager
    def connection():
        yield db
    monkeypatch.setattr(module, "connect", connection)


def test_upload_completion_blocks_existing_job_before_reading_bytes(monkeypatch):
    db = Database(queued() | {"state": "UPLOADING"})
    install_db(monkeypatch, jobs, db)
    monkeypatch.setattr(jobs, "settings", configured())
    monkeypatch.setattr(storage, "read", unexpected)
    with pytest.raises(HTTPException) as error:
        jobs.finalize(db.job["id"], "owner")
    assert error.value.detail["error"] == "UNSUPPORTED_FORMAT"
    assert len(db.calls) == 1  # ownership query only; no freeze/queue mutation


@pytest.mark.parametrize("enabled,tool,code", [(True, "ocr-pdf", "UNSUPPORTED_FORMAT"),
                                              (False, "tar-to-zip", "SERVICE_UNAVAILABLE")])
def test_worker_rechecks_persisted_job_before_attempt_or_storage(monkeypatch, enabled, tool, code):
    db = Database(queued() | {"capability": tool})
    install_db(monkeypatch, tasks, db)
    monkeypatch.setattr(tasks, "settings", configured(enabled=enabled))
    monkeypatch.setattr(storage, "read", unexpected)
    monkeypatch.setattr(tasks, "runner", unexpected)
    tasks.process.run(str(db.job["id"]))
    assert len(db.calls) == 2
    assert "state='FAILED'" in db.calls[1][0]
    assert db.calls[1][1] == (code, str(db.job["id"]))


def test_lifecycle_never_publishes_excluded_job(monkeypatch):
    db = Database(queued())
    install_db(monkeypatch, lifecycle, db)
    monkeypatch.setattr(lifecycle, "settings", configured())
    monkeypatch.setattr(lifecycle.process, "apply_async", unexpected)
    lifecycle.dispatch()
    assert db.calls[-1][1] == ("UNSUPPORTED_FORMAT", db.job["id"])


def test_supervisor_rechecks_before_body_and_docker(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("PRODUCTION_CONVERSIONS_ENABLED", "true")
    monkeypatch.setenv("PRODUCTION_TOOL_ALLOWLIST", "tar-to-zip")
    monkeypatch.setattr(native_runner.docker, "from_env", unexpected)
    with pytest.raises(HTTPException) as error:
        asyncio.run(native_runner.start(uuid4(), "zip-to-tar", None))
    assert error.value.status_code == 404
    semaphore = threading.BoundedSemaphore(1)
    semaphore.acquire()
    monkeypatch.setattr(native_runner, "slots", semaphore)
    source = tmp_path / "input"
    source.write_bytes(b"owned")
    record = {"tool": "zip-to-tar", "input": source, "output": tmp_path / "output"}
    native_runner.execute(record)
    assert record["done"] and record["error"] == "UNSUPPORTED_FORMAT"
    assert not source.exists() and not record["output"].exists()
    assert semaphore.acquire(blocking=False)


def test_tool_scoped_grant_revocation_before_storage_and_legacy_rejection(monkeypatch):
    context = configured("tar-to-zip")
    monkeypatch.setattr(transfers, "settings", context)
    monkeypatch.setattr(transfer_tokens, "settings", context)
    monkeypatch.setenv("TRANSFER_TOKEN_SECRET", "test-transfer-secret-" * 4)
    monkeypatch.setattr(storage, "client", unexpected)
    token = transfer_tokens.issue("PUT", "upload/" + "a" * 32, 60, size=3,
                                 tool="zip-to-tar").split("/transfers/")[1]
    assert transfer_tokens.verify(token)["tool"] == "zip-to-tar"
    legacy = transfer_tokens.issue("PUT", "upload/" + "a" * 32, 60, size=3).split("/transfers/")[1]
    with TestClient(transfers.app) as client:
        headers = {"origin": context.site_origin, "content-type": "application/octet-stream"}
        for rejected in [token, legacy]:
            assert client.put("/transfers/" + rejected, content=b"abc", headers=headers).status_code == 403
        monkeypatch.setattr(transfers, "settings", replace(context, production_conversions=False))
        token = transfer_tokens.issue("PUT", "upload/" + "a" * 32, 60, size=3,
                                     tool="tar-to-zip").split("/transfers/")[1]
        assert client.put("/transfers/" + token, content=b"abc", headers=headers).status_code == 403
    for payload in [[], None, "not an object"]:
        with pytest.raises(ValueError, match="INVALID_GRANT"):
            transfer_tokens._validate(payload, 0)


def test_public_registry_reports_runtime_without_changing_browser_tools(monkeypatch):
    monkeypatch.setattr(api, "settings", configured(""))
    tools = api.public_tools()
    # Source registry stays canonical; deployment availability is separate metadata.
    archive = next(t for t in tools if t["slug"] == "tar-to-zip")
    assert archive["runtimeAvailability"] == {"available": False, "error": "UNSUPPORTED_FORMAT"}
    browser = next(t for t in tools if t["slug"] == "png-to-jpg")
    assert "runtimeAvailability" not in browser

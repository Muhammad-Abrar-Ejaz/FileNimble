import base64
import asyncio
from dataclasses import replace

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.schemas import CreateJob
from app.security import issue_session, read_session


def test_session_is_unpredictable_and_stable():
    first, second = issue_session(), issue_session()
    assert first != second
    assert read_session(first) == read_session(first)
    assert read_session(first) != read_session(second)


@pytest.mark.parametrize("token", ["", "bad", "eA==.forged", "***.signature"])
def test_invalid_sessions_rejected(token):
    with pytest.raises(HTTPException):
        read_session(token)


def test_signed_session_expiry_and_tampering():
    token = issue_session(now=100)
    assert read_session(token, now=101)
    with pytest.raises(HTTPException):
        read_session(token, now=100 + settings.session_ttl)
    body, signature = token.split(".")
    changed = base64.urlsafe_b64encode(("f" * 64 + ":9999999999").encode()).decode()
    with pytest.raises(HTTPException):
        read_session(changed + "." + signature)


@pytest.mark.parametrize("name", ["../x", "a/b", "a\\b", "a\x00b", "x" * 256])
def test_schema_rejects_unsafe_names(name):
    with pytest.raises(ValidationError):
        CreateJob.model_validate(
            {
                "tool": "__fixture__",
                "files": [{"name": name, "size": 12, "type": "application/octet-stream"}],
            }
        )


def test_fixture_cannot_be_enabled_outside_tests():
    with pytest.raises(RuntimeError, match="restricted"):
        replace(settings, environment="production", fixture=True).validate()


@pytest.mark.parametrize(
    "overrides",
    [
        {"max_global_jobs": 0},
        {"max_global_jobs": 9},
        {"max_global_jobs": 2, "max_ip_jobs": 3},
        {"create_rate_per_ip": 0},
        {"create_rate_global": 121},
        {"create_rate_global_window_seconds": 60},
    ],
)
def test_unsafe_beta_admission_limits_are_rejected(overrides):
    candidate = replace(
        settings,
        environment="test",
        fixture=False,
        secret="s" * 32,
        internal_secret="i" * 32,
        runner_secret="r" * 32,
        **overrides,
    )
    with pytest.raises(RuntimeError, match="Unsafe beta conversion admission limits"):
        candidate.validate()


def test_schema_rejects_extra_options_and_large_files():
    for options, size in [({"command": "anything"}, 12), ({}, 1024 * 1024 + 1)]:
        with pytest.raises(ValidationError):
            CreateJob.model_validate(
                {
                    "tool": "__fixture__",
                    "files": [{"name": "x", "size": size, "type": "application/octet-stream"}],
                    "options": options,
                }
            )


def test_job_creation_uses_a_stricter_per_ip_rate_limit(monkeypatch):
    from app import api

    limits = []
    monkeypatch.setattr(api, "require_internal", lambda _value: None)
    monkeypatch.setattr(api, "issue_session", lambda: "synthetic-session")
    monkeypatch.setattr(api, "read_session", lambda _cookie: "synthetic-owner")
    monkeypatch.setattr(api, "digest", lambda _value: "synthetic-ip")
    monkeypatch.setattr(
        api.jobs,
        "rate_limit",
        lambda subject, limit, *args: limits.append((subject, limit)),
    )
    monkeypatch.setattr(
        api.jobs,
        "create",
        lambda *_args: {
            "jobId": "00000000-0000-4000-8000-000000000001",
            "state": "UPLOADING",
            "expiresAt": "2026-10-16T00:00:00+00:00",
            "uploads": [],
        },
    )
    monkeypatch.setattr(
        api.jobs,
        "status",
        lambda *_args: {
            "jobId": "00000000-0000-4000-8000-000000000001",
            "state": "UPLOADING",
            "expiresAt": "2026-10-16T00:00:00+00:00",
            "files": [],
        },
    )

    async def invoke():
        transport = httpx.ASGITransport(app=api.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/jobs",
                headers={
                    "x-internal-key": "synthetic",
                    "Idempotency-Key": "synthetic-key-001",
                    "x-client-ip": "198.51.100.1",
                },
                json={
                    "tool": "__fixture__",
                    "files": [
                        {
                            "name": "test.fixture",
                            "size": 12,
                            "type": "application/octet-stream",
                        }
                    ],
                },
            )
            assert created.status_code == 201
            created_limits = list(limits)
            limits.clear()
            status = await client.get(
                "/api/v1/jobs/00000000-0000-4000-8000-000000000001",
                headers={"x-internal-key": "synthetic", "x-client-ip": "198.51.100.1"},
                cookies={"fn_session": "synthetic-session"},
            )
            assert status.status_code == 200
            return created_limits, list(limits)

    created_limits, status_limits = asyncio.run(invoke())
    assert ("create-ip:synthetic-ip", settings.create_rate_per_ip) in created_limits
    assert not any(subject.startswith("create-") for subject, _ in status_limits)

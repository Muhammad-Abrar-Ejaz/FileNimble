import base64
from dataclasses import replace

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

"""Production boundaries with owned bytes and mocked storage; no external service."""

import asyncio
import json
import io
import tarfile
from types import SimpleNamespace
from dataclasses import replace
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import ai, storage, transfer_tokens, transfers, native_runner
from app.config import settings
from app.oracle_smoke import fixture


@pytest.fixture
def production(monkeypatch):
    configured = replace(
        settings,
        environment="production",
        secret="s" * 64,
        internal_secret="i" * 64,
        runner_secret="r" * 64,
        fixture=False,
        native_test=False,
        transfer_public="https://backend.example.org",
        site_origin="https://file-nimble.vercel.app",
    )
    monkeypatch.setenv("TRANSFER_TOKEN_SECRET", "test-transfer-secret-" * 4)
    monkeypatch.setattr(transfer_tokens, "settings", configured)
    monkeypatch.setattr(transfers, "settings", configured)
    monkeypatch.setattr(storage, "settings", configured)
    monkeypatch.setattr(transfers, "slots", asyncio.Semaphore(2))
    monkeypatch.setattr(
        transfers.shutil, "disk_usage", lambda _: SimpleNamespace(free=20 * 1024**3)
    )
    return configured


def grant(method="PUT", **kwargs):
    role = "upload" if method == "PUT" else "output"
    defaults = (
        {"size": 3}
        if method == "PUT"
        else {"filename": "result.zip", "media_type": "application/zip"}
    )
    return transfer_tokens.issue(method, role + "/" + "a" * 32, 60, **(defaults | kwargs)).split(
        "/transfers/"
    )[1]


def test_deployment_fixture_is_owned_and_roundtrips_tar():
    raw, expected = fixture()
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        assert archive.getnames() == ["notes/owned.txt"]
        assert archive.extractfile("notes/owned.txt").read() == expected


def test_grants_bind_object_method_size_and_expiry(production):
    token = grant()
    payload = transfer_tokens.verify(token)
    assert payload["method"] == "PUT" and payload["size"] == 3
    assert payload["key"] == "upload/" + "a" * 32
    with pytest.raises(ValueError):
        transfer_tokens.verify(token + "x")
    with pytest.raises(ValueError):
        transfer_tokens.verify(token, now=payload["expires"])
    for arguments in (
        {"key": "input/" + "a" * 32},
        {"key": "../etc/passwd"},
        {"size": 25 * 1024 * 1024 + 1},
        {"size": True},
    ):
        with pytest.raises(ValueError):
            transfer_tokens.issue(
                "PUT", arguments.get("key", "upload/" + "a" * 32), 60, size=arguments.get("size", 3)
            )
    for filename in ("../x", "result\r\nHeader: x", 'x".zip', "é.zip"):
        with pytest.raises(ValueError):
            grant("GET", filename=filename)
    assert storage.sign_upload("upload/" + "b" * 32, 30, 3).startswith(production.transfer_public)


@pytest.mark.parametrize(
    "origin",
    [
        "http://backend.example.org",
        "https://127.0.0.1",
        "https://backend.local",
        "https://user:pass@backend.example.org",
        "https://backend.example.org/path",
        "https://backend.example.org:invalid",
    ],
)
def test_production_rejects_unsafe_origins(production, origin):
    with pytest.raises(RuntimeError):
        replace(production, transfer_public=origin).validate()


class Chunks(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"owned"
        yield b"-bytes"


def mocked_storage(monkeypatch, handler):
    class S3:
        def generate_presigned_url(self, _operation, Params, ExpiresIn):
            assert ExpiresIn == 60 and Params["Key"].split("/")[0] in {"upload", "output"}
            return "http://storage:3900/private"

    monkeypatch.setattr(storage, "client", lambda: S3())
    real_client = httpx.AsyncClient
    clients = []

    def factory(**kwargs):
        assert kwargs["trust_env"] is False and kwargs["follow_redirects"] is False
        client = real_client(transport=httpx.MockTransport(handler), **kwargs)
        clients.append(client)
        return client

    monkeypatch.setattr(transfers.httpx, "AsyncClient", factory)
    return clients


def test_gateway_streams_upload_and_download_and_cleans_resources(production, monkeypatch):
    seen = []

    async def upstream(request):
        assert str(request.url) == "http://storage:3900/private"
        seen.append((request.method, await request.aread()))
        if request.method == "PUT":
            return httpx.Response(200)
        return httpx.Response(200, headers={"content-length": "11"}, stream=Chunks())

    clients = mocked_storage(monkeypatch, upstream)
    with TestClient(transfers.app) as client:
        headers = {"origin": production.site_origin, "content-type": "application/octet-stream"}
        token = grant()
        response = client.options(
            "/transfers/" + token,
            headers={
                "Origin": production.site_origin,
                "Access-Control-Request-Method": "PUT",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 204
        response = client.put("/transfers/" + token, content=b"abc", headers=headers)
        assert response.status_code == 204 and seen[0] == ("PUT", b"abc")
        response = client.get(
            "/transfers/" + grant("GET"), headers={"origin": production.site_origin}
        )
        assert response.content == b"owned-bytes" and response.status_code == 200
        assert response.headers["access-control-allow-origin"] == production.site_origin
        assert response.headers["content-disposition"] == 'attachment; filename="result.zip"'
        assert response.headers["cache-control"] == "no-store"
    assert all(c.is_closed for c in clients)
    assert transfers.slots._value == 2


def test_gateway_rejects_origin_method_size_and_expired_grants_before_storage(
    production, monkeypatch
):
    def unexpected():
        raise AssertionError("Invalid transfer must never access storage")

    monkeypatch.setattr(storage, "client", unexpected)
    with TestClient(transfers.app) as client:
        token = grant()
        assert client.get("/transfers/" + token).status_code == 403
        assert client.put("/transfers/" + token, content=b"abc").status_code == 403
        assert (
            client.put(
                "/transfers/" + token, content=b"abc", headers={"origin": "https://evil.example"}
            ).status_code
            == 403
        )
        assert (
            client.put(
                "/transfers/" + token,
                content=b"abcd",
                headers={
                    "origin": production.site_origin,
                    "content-type": "application/octet-stream",
                },
            ).status_code
            == 413
        )
        assert client.get("/transfers/forged").status_code == 403
        assert (
            client.options(
                "/transfers/" + token,
                headers={
                    "Origin": production.site_origin,
                    "Access-Control-Request-Method": "PUT",
                    "Access-Control-Request-Headers": "authorization",
                },
            ).status_code
            == 403
        )
    assert transfers.slots._value == 2


@pytest.mark.parametrize(
    "status,length,expected", [(404, "0", 404), (200, "104857601", 503), (302, "11", 503)]
)
def test_gateway_missing_oversized_or_redirected_storage_is_rejected(
    production, monkeypatch, status, length, expected
):
    async def upstream(_request):
        return httpx.Response(status, headers={"content-length": length}, stream=Chunks())

    clients = mocked_storage(monkeypatch, upstream)
    with TestClient(transfers.app) as client:
        response = client.get("/transfers/" + grant("GET"))
        assert response.status_code == expected
    assert all(c.is_closed for c in clients) and transfers.slots._value == 2


def test_gemini_fixed_endpoint_header_only_key_and_text_contract(monkeypatch):
    seen = []

    async def upstream(request):
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": "hidden reasoning", "thought": True},
                                {"text": "Owned summary"},
                            ]
                        },
                    }
                ],
                "usageMetadata": {"promptTokenCount": 2, "candidatesTokenCount": 3},
            },
        )

    provider = ai.GeminiProvider("test-only-key", "fixture-model", httpx.MockTransport(upstream))
    assert asyncio.run(provider.generate("rules", "owned text")) == ai.AIResult(
        "Owned summary", "gemini", 2, 3
    )
    request = seen[0]
    assert (
        str(request.url)
        == "https://generativelanguage.googleapis.com/v1beta/models/fixture-model:generateContent"
    )
    assert request.headers["x-goog-api-key"] == "test-only-key" and "key=" not in str(request.url)
    payload = json.loads(request.content)
    assert (
        "tools" not in payload
        and payload["generationConfig"]["maxOutputTokens"] == ai.MAX_OUTPUT_TOKENS
    )
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("AI_MODEL", "fixture-model")
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-key")
    monkeypatch.setenv("AI_ENABLED", "false")
    assert ai.provider_from_environment() is None
    monkeypatch.setenv("AI_ENABLED", "true")
    assert isinstance(ai.provider_from_environment(), ai.GeminiProvider)
    with pytest.raises(ValueError):
        ai.GeminiProvider("key", "../host?key=leak")


def test_storage_close_error_still_closes_client_and_releases_slot(production, monkeypatch):
    class BrokenClose(Chunks):
        async def aclose(self):
            raise RuntimeError("fixture close failure")

    async def upstream(_request):
        return httpx.Response(500, headers={"content-length": "11"}, stream=BrokenClose())

    clients = mocked_storage(monkeypatch, upstream)
    with TestClient(transfers.app) as client:
        response = client.get("/transfers/" + grant("GET"))
        assert response.status_code == 503
        assert "fixture close failure" not in response.text
    assert all(c.is_closed for c in clients)
    assert transfers.slots._value == 2


@pytest.mark.parametrize(
    "response",
    [
        {"candidates": []},
        {"candidates": [{"finishReason": "MAX_TOKENS"}]},
        {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"functionCall": {}}]}}]},
    ],
)
def test_gemini_rejects_blocked_truncated_and_nontext_responses(response):
    provider = ai.GeminiProvider(
        "key", "fixture-model", httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(provider.generate("rules", "owned text"))
    assert error.value.detail["error"] == "AI_INVALID_RESPONSE"


@pytest.mark.parametrize("key", ["key\tbad", "clé"])
def test_gemini_bad_header_credentials_fail_closed(monkeypatch, key):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("AI_MODEL", "fixture-model")
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", key)
    assert ai.provider_from_environment() is None


def test_low_disk_rejects_new_upload_without_touching_storage(production, monkeypatch):
    monkeypatch.setattr(
        transfers.shutil, "disk_usage", lambda _: SimpleNamespace(free=11 * 1024**3)
    )
    with TestClient(transfers.app) as client:
        response = client.put(
            "/transfers/" + grant(),
            content=b"abc",
            headers={"origin": production.site_origin, "content-type": "application/octet-stream"},
        )
        assert response.status_code == 507
    assert transfers.slots._value == 2


def test_production_runner_preserves_gates_and_disable_switch(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("PRODUCTION_CONVERSIONS_ENABLED", "true")
    for tool in ["word-to-pdf", "video-mute", "pdf-to-pdfa", "unlock-pdf"]:
        with pytest.raises(HTTPException) as error:
            asyncio.run(native_runner.start(uuid4(), tool, None))
        assert error.value.status_code == 404
    monkeypatch.setenv("PRODUCTION_CONVERSIONS_ENABLED", "false")
    with pytest.raises(HTTPException) as error:
        asyncio.run(native_runner.start(uuid4(), "tar-to-zip", None))
    assert error.value.status_code == 503

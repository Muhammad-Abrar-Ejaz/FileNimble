"""Production-policy API capacity tests against a uniquely isolated synthetic stack."""

import io
import json
import time
import tarfile
import zipfile
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import httpx
from app.config import settings
from app.security import issue_session
from app.db import connect
from app import lifecycle, storage

RESULT = {}


class GateFailure(AssertionError):
    """A deliberately sanitized capacity assertion failure."""

    def __init__(self, category):
        super().__init__(category)
        self.category = category


SAFE_ERROR_CODES = {
    "UNSUPPORTED_FORMAT",
    "WORKER_LOST",
    "SERVICE_UNAVAILABLE",
    "QUEUE_FULL",
    "INTERNAL_ERROR",
    "STORAGE_UNAVAILABLE",
    "CONVERSION_FAILED",
    "UPLOAD_INCOMPLETE",
    "TIMEOUT",
    "CANCELLED",
    "AI_DISABLED",
}


def safe_error_code(value):
    return value if isinstance(value, str) and value in SAFE_ERROR_CODES else "OTHER"


def error_code(response):
    try:
        value = response.json().get("error")
    except (ValueError, AttributeError):
        value = None
    return safe_error_code(value)


PAYLOAD = b"Capacity synthetic payload\n" * 12000


def archive(kind):
    buf = io.BytesIO()
    if kind == "tar":
        with tarfile.open(fileobj=buf, mode="w", format=tarfile.USTAR_FORMAT) as f:
            m = tarfile.TarInfo("payload.txt")
            m.size = len(PAYLOAD)
            f.addfile(m, io.BytesIO(PAYLOAD))
    else:
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as f:
            f.writestr("payload.txt", PAYLOAD)
    return buf.getvalue()


DATA = {kind: archive(kind) for kind in ["tar", "zip"]}


def client(ip=None):
    c = httpx.Client(
        base_url="http://api:8000",
        timeout=30,
        headers={"x-internal-key": settings.internal_secret, "x-client-ip": ip or str(uuid4())},
    )
    c.cookies.set("fn_session", issue_session())
    return c


def create(c, kind="tar"):
    return c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": kind + "-to-" + ("zip" if kind == "tar" else "tar"),
            "files": [
                {
                    "name": "synthetic." + kind,
                    "size": len(DATA[kind]),
                    "type": "application/x-tar" if kind == "tar" else "application/zip",
                }
            ],
        },
    )


def query(sql, args=()):
    with connect() as db:
        return db.execute(sql, args).fetchall()


def scalar(sql, args=()):
    return next(iter(query(sql, args)[0].values()))


def transfer(url, method, data=None):
    assert url.startswith(settings.transfer_public + "/transfers/")
    return httpx.request(
        method,
        "http://transfers:8002" + url[len(settings.transfer_public) :],
        content=data,
        headers={"origin": settings.site_origin, "content-type": "application/octet-stream"},
        timeout=30,
    )


def reset():
    with connect() as db:
        db.execute(
            "UPDATE conversion_jobs SET state='CANCELLED',deleted_at=now(),cleanup_after=now(),upload_expires_at=now()-interval '91 seconds' WHERE purged_at IS NULL"
        )
    lifecycle.cleanup()
    with connect() as db:
        db.execute("DELETE FROM quota_windows")


def delete(c, j):
    assert c.delete("/api/v1/jobs/" + j["jobId"]).status_code == 200


def counts():
    return (
        scalar("select count(*) from conversion_jobs"),
        scalar("select count(*) from job_files"),
    )


def check(name, fn):
    t = time.monotonic()
    try:
        reset()
        evidence = fn()
        RESULT[name] = {
            "result": "PASS",
            "elapsed_seconds": round(time.monotonic() - t, 3),
            "evidence": evidence,
        }
    except Exception as e:
        import traceback

        frames = traceback.extract_tb(e.__traceback__)
        RESULT[name] = {
            "result": "FAIL",
            "category": getattr(e, "category", type(e).__name__),
            "line": frames[-1].lineno,
            "function": frames[-1].name,
            "elapsed_seconds": round(time.monotonic() - t, 3),
        }


def admission():
    baseline = counts()

    def request(_):
        with client() as c:
            r = create(c)
            return r.status_code, r.json()

    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(request, range(8)))
    assert [s for s, _ in responses].count(201) == 4
    assert [s for s, _ in responses].count(429) == 4
    assert all(b["error"] == "QUEUE_FULL" and "uploads" not in b for s, b in responses if s == 429)
    assert counts() == (baseline[0] + 4, baseline[1] + 4)
    with client() as c:
        before = counts()
        r = create(c)
        assert r.status_code == 429 and r.json()["error"] == "QUEUE_FULL" and counts() == before
    return {"admitted": 4, "race_rejected": 4, "fifth_status": 429, "rejected_rows_or_grants": 0}


def perip():
    shared = "198.51.100.42"

    def request(i):
        with client(shared) as c:
            c.headers["x-forwarded-for"] = "203.0.113." + str(i + 1)
            c.headers["forwarded"] = "for=203.0.113." + str(i + 1)
            return create(c).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(request, range(8)))
    assert codes.count(201) == 2 and codes.count(429) == 6
    return {
        "same_ip_sessions_admitted": 2,
        "rejected": 6,
        "untrusted_forwarding_did_not_bypass": True,
    }


def rate():
    # Stay inside one real fixed minute window; no server clock/config change.
    if time.time() % 60 > 40:
        time.sleep(61 - time.time() % 60)
    start = int(time.time()) // 60
    for _ in range(10):
        with client("198.51.100.43") as c:
            r = create(c)
            assert r.status_code == 201
            delete(c, r.json())
    with client("198.51.100.43") as c:
        before = counts()
        r = create(c)
        assert r.status_code == 429 and counts() == before
    assert int(time.time()) // 60 == start
    return {"successful_attempts": 10, "eleventh_status": 429}


def hourly():
    start = int(time.time()) // 3600
    for _ in range(20):
        with client() as c:
            r = create(c)
            assert r.status_code == 201
            delete(c, r.json())
    with client() as c:
        before = counts()
        r = create(c)
        assert r.status_code == 429 and counts() == before
    assert int(time.time()) // 3600 == start
    assert (
        scalar(
            "select requests from quota_windows where subject='create-global' and window_id=%s",
            (start,),
        )
        == 20
    )
    return {"actual_api_admissions": 20, "twenty_first_status": 429, "quota_after_rejection": 20}


def queue():
    clients = [client() for _ in range(4)]
    jobs = []
    latencies = []
    states = set()
    t = time.monotonic()
    try:
        for c, kind in zip(clients, ["tar", "zip", "tar", "zip"], strict=True):
            r = create(c, kind)
            assert r.status_code == 201
            j = r.json()
            j["kind"] = kind
            j["started"] = time.monotonic()
            jobs.append(j)
            assert transfer(j["uploads"][0]["url"], "PUT", DATA[kind]).status_code == 204
        for c, j in zip(clients, jobs, strict=True):
            assert c.post("/api/v1/jobs/" + j["jobId"] + "/complete-upload").status_code == 200
        pending = set(range(4))
        deadline = time.monotonic() + 100
        while pending and time.monotonic() < deadline:
            for i in list(pending):
                j = jobs[i]
                r = clients[i].get("/api/v1/jobs/" + j["jobId"])
                assert r.status_code == 200
                status = r.json()
                states.add(status["state"])
                if status["state"] in ["FAILED", "EXPIRED", "CANCELLED"]:
                    code = (
                        status.get("error") or status.get("errorCode") or status.get("error_code")
                    )
                    safe = safe_error_code(code)
                    raise GateFailure("conversion_" + status["state"].lower() + "_" + safe.lower())
                if status["state"] == "COMPLETED":
                    j["status"] = status
                    latencies.append(round(time.monotonic() - j["started"], 3))
                    pending.remove(i)
            time.sleep(0.1)
        assert not pending
        processing_wall = time.monotonic() - t
        for c, j in zip(clients, jobs, strict=True):
            r = c.post(
                "/api/v1/jobs/" + j["jobId"] + "/download-token",
                json={"fileId": j["status"]["files"][0]["fileId"]},
            )
            assert r.status_code == 200
            url = r.json()["url"]
            r = transfer(url, "GET")
            assert r.status_code == 200
            if j["kind"] == "tar":
                with zipfile.ZipFile(io.BytesIO(r.content)) as a:
                    assert a.namelist() == ["payload.txt"] and a.read("payload.txt") == PAYLOAD
            else:
                with tarfile.open(fileobj=io.BytesIO(r.content), mode="r:") as a:
                    assert (
                        a.getnames() == ["payload.txt"]
                        and a.extractfile("payload.txt").read() == PAYLOAD
                    )
            delete(c, j)
            lifecycle.cleanup()
            assert transfer(url, "GET").status_code == 404
        ids = [j["jobId"] for j in jobs]
        rows = query(
            "select started_at,finished_at from job_attempts where job_id=ANY(%s::uuid[]) order by started_at",
            (ids,),
        )
        assert len(rows) == 4 and all(row["finished_at"] for row in rows)
        assert all(rows[i]["finished_at"] <= rows[i + 1]["started_at"] for i in range(3))
        assert (
            scalar(
                "select count(*) from job_files where job_id=ANY(%s::uuid[]) and purged_at is null",
                (ids,),
            )
            == 0
        )
        for row in query("select object_key from job_files where job_id=ANY(%s::uuid[])", (ids,)):
            try:
                storage.client().head_object(Bucket=settings.bucket, Key=row["object_key"])
                raise AssertionError("object_remains")
            except storage.client().exceptions.ClientError as e:
                assert e.response["ResponseMetadata"]["HTTPStatusCode"] == 404
        return {
            "completed": 4,
            "states_observed": sorted(states),
            "nonoverlapping_worker_attempts": 4,
            "latency_seconds": latencies,
            "processing_wall_seconds": round(processing_wall, 3),
            "jobs_per_second": round(4 / processing_wall, 3),
            "payload_bytes_each": len(PAYLOAD),
            "exact_integrity": True,
            "storage_object_deletion_verified": True,
        }
    finally:
        for c in clients:
            c.close()


def expiry():
    with client() as c:
        r = create(c)
        assert r.status_code == 201
        j = r.json()
        assert transfer(j["uploads"][0]["url"], "PUT", DATA["tar"]).status_code == 204
        query(
            "UPDATE conversion_jobs SET upload_expires_at=now()-interval '30 seconds' WHERE id=%s RETURNING id",
            (j["jobId"],),
        )
        lifecycle.cleanup()
        assert scalar("select purged_at is null from conversion_jobs where id=%s", (j["jobId"],))
        query(
            "UPDATE conversion_jobs SET upload_expires_at=now()-interval '91 seconds' WHERE id=%s RETURNING id",
            (j["jobId"],),
        )
        lifecycle.cleanup()
        assert scalar("select state from conversion_jobs where id=%s", (j["jobId"],)) == "EXPIRED"
        assert (
            scalar(
                "select count(*) from job_files where job_id=%s and purged_at is null",
                (j["jobId"],),
            )
            == 0
        )
    return {
        "cleanup_grace_30_seconds_preserved": True,
        "past_90_seconds_purged": True,
        "clock": "synthetic row timestamps only",
    }


def malformed():
    with client() as c:
        r = create(c)
        assert r.status_code == 201
        j = r.json()
        assert transfer(j["uploads"][0]["url"], "PUT", b"x" * len(DATA["tar"])).status_code == 204
        r = c.post("/api/v1/jobs/" + j["jobId"] + "/complete-upload")
        assert r.status_code == 400
        delete(c, j)
        lifecycle.cleanup()
        assert (
            scalar(
                "select count(*) from job_files where job_id=%s and purged_at is null",
                (j["jobId"],),
            )
            == 0
        )
    return {"malformed_rejected": True, "cleanup": True}


def disabled():
    with client() as c:
        tools = c.get("/api/v1/tools")
        if tools.status_code != 200:
            raise GateFailure("tool_catalog_http_" + str(tools.status_code))
        enabled = {
            x["slug"]
            for x in tools.json()
            if x.get("processingMode") == "server"
            and x.get("runtimeAvailability", {}).get("available") is True
        }
        if enabled != {"tar-to-zip", "zip-to-tar"}:
            raise GateFailure("runtime_allowlist_mismatch")
        inputs = {
            "image-to-text": ("x.png", "image/png"),
            "wav-to-flac": ("x.wav", "audio/wav"),
            "word-to-pdf": (
                "x.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        }
        for tool, (filename, mime) in inputs.items():
            r = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={"tool": tool, "files": [{"name": filename, "size": 100, "type": mime}]},
            )
            if r.status_code != 400 or error_code(r) != "UNSUPPORTED_FORMAT":
                raise GateFailure(
                    "disabled_"
                    + tool
                    + "_status_"
                    + str(r.status_code)
                    + "_error_"
                    + error_code(r).lower()
                )
        status = c.get("/api/v1/ai/status")
        if status.status_code != 200 or status.json() != {"enabled": False, "provider": None}:
            raise GateFailure("ai_status_not_disabled")
        r = c.post("/api/v1/ai/process", json={"tool": "summarize-text", "text": "Synthetic"})
        if r.status_code != 503 or error_code(r) != "AI_DISABLED":
            raise GateFailure(
                "ai_process_status_" + str(r.status_code) + "_error_" + error_code(r).lower()
            )
    with httpx.Client(base_url="http://api:8000") as c:
        r = c.post(
            "/api/v1/jobs",
            headers={"x-client-ip": "arbitrary", "x-forwarded-for": "arbitrary"},
            json={},
        )
        if r.status_code != 401:
            raise GateFailure("unauthenticated_request_status_" + str(r.status_code))
    return {
        "runtime_enabled_tools": sorted(enabled),
        "disabled_tools_rejected": "UNSUPPORTED_FORMAT",
        "ai_status": status.json(),
        "ai_process_rejected": "AI_DISABLED",
        "unauthenticated_forwarding_rejected": True,
    }


HEALTH = {}
for name, url in [("api", "http://api:8000/health"), ("transfers", "http://transfers:8002/health")]:
    for _ in range(60):
        try:
            if httpx.get(url, timeout=2).status_code == 200:
                HEALTH[name] = {"result": "PASS"}
                break
        except httpx.HTTPError as error:
            HEALTH[name] = {"last_error_category": type(error).__name__}
        time.sleep(1)
    else:
        HEALTH[name] = {"result": "FAIL", "category": "health_timeout"}
RESULT["service_health"] = {
    "result": "PASS" if all(x["result"] == "PASS" for x in HEALTH.values()) else "FAIL",
    "evidence": HEALTH,
}
tests = [
    ("global_admission", admission),
    ("per_ip_race", perip),
    ("minute_rate", rate),
    ("hourly_quota", hourly),
    ("four_real_conversions", queue),
    ("expired_upload_cleanup", expiry),
    ("malformed_upload", malformed),
    ("disabled_tools_auth", disabled),
]
if os.getenv("CAPACITY_FOCUSED_CLEANUP") == "1":
    tests = [("expired_upload_cleanup", expiry), ("malformed_upload", malformed)]
if os.getenv("CAPACITY_FOCUSED_DISABLED") == "1":
    tests = [("disabled_tools_auth", disabled)]
for name, fn in tests:
    check(name, fn)
try:
    reset()
    assert scalar("select count(*) from job_files where purged_at is null") == 0
    assert storage.client().list_objects_v2(Bucket=settings.bucket).get("KeyCount", 0) == 0
    RESULT["final_cleanup"] = {
        "result": "PASS",
        "unpurged_metadata_rows": 0,
        "visible_storage_objects": 0,
    }
except Exception:
    RESULT["final_cleanup"] = {"result": "FAIL"}
print(json.dumps(RESULT))
if any(
    value.get("result") != "PASS"
    for value in RESULT.values()
    if isinstance(value, dict) and "result" in value
):
    raise SystemExit(1)

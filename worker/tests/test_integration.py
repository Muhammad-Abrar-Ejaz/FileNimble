"""Real Compose services. Failure injection targets only filenimble-local containers."""

import json
import os
import time
from contextlib import ExitStack
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import docker
import httpx
import pytest
from botocore.exceptions import ClientError

from app import storage
from app.config import settings
from app.db import connect, migrate
from app.jobs import ACTIVE
from app.lifecycle import cleanup, recover
from app.security import digest, issue_session
from app.tasks import process

pytestmark = pytest.mark.integration
API = os.getenv("API_URL", "http://api:8000")
DATA = b"%FN-FIXTURE\nproject owned example"


def client():
    return httpx.Client(
        base_url=API,
        headers={"x-internal-key": settings.internal_secret, "x-client-ip": str(uuid4())},
        timeout=10,
    )


def create(c, data=DATA, behavior="normal", key=None):
    response = c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": key or str(uuid4())},
        json={
            "tool": "__fixture__",
            "files": [
                {"name": "test.fixture", "size": len(data), "type": "application/octet-stream"}
            ],
            "options": {"behavior": behavior},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def upload(job, data=DATA):
    grant = job["uploads"][0]
    response = httpx.put(grant["url"], content=data, headers=grant["headers"], timeout=10)
    assert response.status_code == 200, response.text


def finalize(c, job):
    response = c.post(f"/api/v1/jobs/{job['jobId']}/complete-upload")
    assert response.status_code == 200, response.text


def wait(c, job, state="COMPLETED", timeout=35):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = c.get(f"/api/v1/jobs/{job['jobId']}")
        assert response.status_code == 200, response.text
        status = response.json()
        if status["state"] == state:
            return status
        if state == "COMPLETED" and status["state"] in ("FAILED", "CANCELLED", "EXPIRED"):
            pytest.fail(str(status))
        time.sleep(0.3)
    pytest.fail(f"Job did not reach {state}")


def download(c, job, status):
    response = c.post(
        f"/api/v1/jobs/{job['jobId']}/download-token", json={"fileId": status["files"][0]["fileId"]}
    )
    assert response.status_code == 200, response.text
    response = httpx.get(response.json()["url"], timeout=10)
    assert response.status_code == 200, response.text
    return response.content


def service(name):
    engine = docker.from_env()
    matches = engine.containers.list(
        all=True,
        filters={
            "label": [
                "com.docker.compose.project=filenimble-local",
                f"com.docker.compose.service={name}",
            ]
        },
    )
    assert len(matches) == 1
    return matches[0]


@pytest.fixture(autouse=True)
def isolated():
    assert settings.environment == "test" and settings.fixture
    with connect() as db:
        db.execute("DELETE FROM quota_windows")
    yield
    with connect() as db:
        db.execute(
            "UPDATE conversion_jobs SET state='CANCELLED',cleanup_after=now(),upload_expires_at=now() WHERE state IN ('UPLOADING','QUEUED','PROCESSING','VALIDATING')"
        )
    time.sleep(0.4)


def test_migrations_are_repeatable_and_schema_is_real():
    migrate()
    migrate()
    with connect() as db:
        assert db.execute("SELECT count(*) AS n FROM schema_migrations").fetchone()["n"] == 1
        assert (
            db.execute("SELECT to_regclass('job_attempts') AS t").fetchone()["t"] == "job_attempts"
        )


def test_public_registry_and_client_only_rejection():
    with client() as c:
        records = c.get("/api/v1/tools").json()
        assert not any(t["slug"] == "__fixture__" for t in records)
        assert c.get("/api/v1/tools/pdf-to-jpg").json()["processingMode"] == "client"
        body = {
            "tool": "pdf-to-jpg",
            "files": [
                {"name": "test.fixture", "size": len(DATA), "type": "application/octet-stream"}
            ],
        }
        response = c.post("/api/v1/jobs", headers={"Idempotency-Key": str(uuid4())}, json=body)
        assert response.status_code == 400
        assert response.json()["error"] == "UNSUPPORTED_FORMAT"


def test_entire_pipeline_download_expiry_and_confirmed_cleanup():
    with client() as c:
        job = create(c)
        upload(job)
        finalize(c, job)
        status = wait(c, job)
        assert download(c, job, status) == b"%FN-RESULT\nPROJECT OWNED EXAMPLE"
        assert c.get(f"/api/v1/jobs/{job['jobId']}").headers["cache-control"] == "no-store"
        with connect() as db:
            files = db.execute(
                "SELECT * FROM job_files WHERE job_id=%s", (job["jobId"],)
            ).fetchall()
            assert {f["role"] for f in files} == {"upload", "input", "output"}
            assert all("test.fixture" not in f["object_key"] for f in files)
            db.execute(
                "UPDATE conversion_jobs SET expires_at=now()-interval '1 second',upload_expires_at=now()-interval '1 second' WHERE id=%s",
                (job["jobId"],),
            )
        denied = c.post(
            f"/api/v1/jobs/{job['jobId']}/download-token",
            json={"fileId": status["files"][0]["fileId"]},
        )
        assert denied.status_code == 410
        cleanup()
        cleanup()
        with connect() as db:
            assert db.execute(
                "SELECT purged_at FROM conversion_jobs WHERE id=%s", (job["jobId"],)
            ).fetchone()["purged_at"]
        for file in files:
            with pytest.raises(ClientError):
                storage.client().head_object(Bucket=settings.bucket, Key=file["object_key"])


def test_cross_session_all_private_operations_and_output_ownership():
    with client() as a, client() as b:
        job = create(a)
        other = create(b)
        upload(job)
        finalize(a, job)
        status = wait(a, job)
        path = f"/api/v1/jobs/{job['jobId']}"
        for method, suffix, body in [
            ("GET", "", None),
            ("POST", "/complete-upload", None),
            ("POST", "/cancel", None),
            ("DELETE", "", None),
            ("POST", "/download-token", {"fileId": status["files"][0]["fileId"]}),
        ]:
            assert b.request(method, path + suffix, json=body).status_code == 404
        assert (
            a.post(
                path + "/download-token", json={"fileId": other["uploads"][0]["fileId"]}
            ).status_code
            == 404
        )
        assert a.get("/api/v1/jobs/" + str(uuid4())).status_code == 404
        assert a.get("/api/v1/jobs/not-a-uuid").status_code == 422


def test_internal_auth_session_tampering_and_expiry():
    assert httpx.get(API + "/api/v1/tools").status_code == 401
    with client() as c:
        job = create(c)
        for token in ["forged.signature", issue_session(now=0)]:
            with client() as attacker:
                attacker.cookies.set("fn_session", token)
                assert attacker.get(f"/api/v1/jobs/{job['jobId']}").status_code == 401


def test_idempotency_concurrent_reservation_and_conflict():
    with client() as c:
        key = str(uuid4())
        job = create(c, key=key)
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs = list(pool.map(lambda _: create(c, key=key), range(4)))
        assert all(j["jobId"] == job["jobId"] for j in jobs)
        response = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": key},
            json={
                "tool": "__fixture__",
                "files": [
                    {"name": "different", "size": len(DATA), "type": "application/octet-stream"}
                ],
            },
        )
        assert response.status_code == 409
        with connect() as db:
            assert (
                db.execute(
                    "SELECT count(*) AS n FROM conversion_jobs WHERE id=%s", (job["jobId"],)
                ).fetchone()["n"]
                == 1
            )


def test_global_queue_admission_is_atomic_across_anonymous_sessions():
    active_states = ["CREATED", "UPLOADING", "VALIDATING", "QUEUED", "PROCESSING"]
    with connect() as db:
        baseline = db.execute(
            "SELECT count(*) AS n FROM conversion_jobs WHERE state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL",
            (active_states,),
        ).fetchone()["n"]
        total_before = db.execute("SELECT count(*) AS n FROM conversion_jobs").fetchone()["n"]
    assert baseline == 0, "isolated stack must start with no active jobs"

    def submit(_index):
        with client() as c:
            response = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "__fixture__",
                    "files": [
                        {
                            "name": "test.fixture",
                            "size": len(DATA),
                            "type": "application/octet-stream",
                        }
                    ],
                    "options": {"behavior": "normal"},
                },
            )
            return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(submit, range(8)))

    accepted = [body for status, body in results if status == 201]
    rejected = [body for status, body in results if status == 429]
    assert len(accepted) == settings.max_global_jobs
    assert len(rejected) == 8 - settings.max_global_jobs
    assert all(body["error"] == "QUEUE_FULL" for body in rejected)
    assert all("Try again" in body["message"] for body in rejected)
    with connect() as db:
        active = db.execute(
            "SELECT count(*) AS n FROM conversion_jobs WHERE state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL",
            (active_states,),
        ).fetchone()["n"]
        total_after = db.execute("SELECT count(*) AS n FROM conversion_jobs").fetchone()["n"]
    assert active == settings.max_global_jobs
    assert total_after == total_before + settings.max_global_jobs


def test_active_job_limit_is_shared_by_anonymous_sessions_from_one_ip():
    raw_ip = "198.51.100.42"
    clients = []
    try:
        for _ in range(settings.max_ip_jobs):
            c = httpx.Client(
                base_url=API,
                headers={"x-internal-key": settings.internal_secret, "x-client-ip": raw_ip},
                timeout=10,
            )
            clients.append(c)
            assert create(c)
        c = httpx.Client(
            base_url=API,
            headers={"x-internal-key": settings.internal_secret, "x-client-ip": raw_ip},
            timeout=10,
        )
        clients.append(c)
        response = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "tool": "__fixture__",
                "files": [
                    {
                        "name": "test.fixture",
                        "size": len(DATA),
                        "type": "application/octet-stream",
                    }
                ],
            },
        )
        assert response.status_code == 429
        assert response.json()["error"] == "RATE_LIMITED"
    finally:
        for c in clients:
            c.close()


def test_per_ip_active_job_limit_is_atomic_across_concurrent_sessions():
    raw_ip = "198.51.100.45"

    def submit(_index):
        with httpx.Client(
            base_url=API,
            headers={"x-internal-key": settings.internal_secret, "x-client-ip": raw_ip},
            timeout=10,
        ) as c:
            response = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "__fixture__",
                    "files": [
                        {
                            "name": "test.fixture",
                            "size": len(DATA),
                            "type": "application/octet-stream",
                        }
                    ],
                },
            )
            return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(submit, range(8)))
    assert sum(status == 201 for status, _ in results) == settings.max_ip_jobs
    rejected = [body for status, body in results if status == 429]
    assert len(rejected) == 8 - settings.max_ip_jobs
    assert all(body["error"] == "RATE_LIMITED" for body in rejected)
    with connect() as db:
        assert (
            db.execute(
                "SELECT count(*) AS n FROM conversion_jobs WHERE ip_hash=%s AND state=ANY(%s) AND expires_at>now() AND deleted_at IS NULL",
                (digest(raw_ip), list(ACTIVE)),
            ).fetchone()["n"]
            == settings.max_ip_jobs
        )


def test_creation_rate_limit_is_shared_by_anonymous_sessions_from_one_ip():
    raw_ip = "198.51.100.43"
    responses = []
    for _ in range(settings.create_rate_per_ip + 1):
        with httpx.Client(
            base_url=API,
            headers={"x-internal-key": settings.internal_secret, "x-client-ip": raw_ip},
            timeout=10,
        ) as c:
            responses.append(
                c.post(
                    "/api/v1/jobs",
                    headers={"Idempotency-Key": str(uuid4())},
                    json={
                        "tool": "__fixture__",
                        "files": [
                            {
                                "name": "test.fixture",
                                "size": len(DATA),
                                "type": "application/octet-stream",
                            }
                        ],
                    },
                )
            )
    assert responses[-1].status_code == 429
    assert responses[-1].json() == {
        "error": "RATE_LIMITED",
        "message": "Please wait before trying again.",
    }


def test_global_hourly_admission_limit_is_transactional():
    window_id = int(time.time()) // 3600
    try:
        with connect() as db:
            db.execute(
                "INSERT INTO quota_windows(subject,window_id,requests) VALUES ('create-global',%s,%s) ON CONFLICT(subject,window_id) DO UPDATE SET requests=EXCLUDED.requests",
                (window_id, settings.create_rate_global),
            )
        with client() as c:
            response = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "__fixture__",
                    "files": [
                        {
                            "name": "test.fixture",
                            "size": len(DATA),
                            "type": "application/octet-stream",
                        }
                    ],
                },
            )
            assert response.status_code == 429
            assert response.json()["error"] == "RATE_LIMITED"
        with connect() as db:
            assert (
                db.execute(
                    "SELECT requests FROM quota_windows WHERE subject='create-global' AND window_id=%s",
                    (window_id,),
                ).fetchone()["requests"]
                == settings.create_rate_global
            )
    finally:
        with connect() as db:
            db.execute(
                "DELETE FROM quota_windows WHERE subject='create-global' AND window_id=%s",
                (window_id,),
            )


def test_global_hourly_admission_limit_is_atomic_under_race():
    window_id = int(time.time()) // 3600
    with connect() as db:
        db.execute(
            "INSERT INTO quota_windows(subject,window_id,requests) VALUES ('create-global',%s,%s) ON CONFLICT(subject,window_id) DO UPDATE SET requests=EXCLUDED.requests",
            (window_id, settings.create_rate_global - 1),
        )

    def submit(_index):
        with client() as c:
            response = c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "__fixture__",
                    "files": [
                        {
                            "name": "test.fixture",
                            "size": len(DATA),
                            "type": "application/octet-stream",
                        }
                    ],
                },
            )
            return response.status_code, response.json()

    try:
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(submit, range(8)))
        assert sum(status == 201 for status, _ in results) == 1
        rejected = [body for status, body in results if status == 429]
        assert len(rejected) == 7
        assert all(body["error"] == "RATE_LIMITED" for body in rejected)
        with connect() as db:
            assert (
                db.execute(
                    "SELECT requests FROM quota_windows WHERE subject='create-global' AND window_id=%s",
                    (window_id,),
                ).fetchone()["requests"]
                == settings.create_rate_global
            )
    finally:
        with connect() as db:
            db.execute(
                "DELETE FROM quota_windows WHERE subject='create-global' AND window_id=%s",
                (window_id,),
            )


def test_expired_upload_releases_capacity_and_cleans_the_temporary_object():
    raw_ip = "198.51.100.44"
    with httpx.Client(
        base_url=API,
        headers={"x-internal-key": settings.internal_secret, "x-client-ip": raw_ip},
        timeout=10,
    ) as c:
        abandoned = create(c)
        upload(abandoned)
        with connect() as db:
            uploaded = db.execute(
                "SELECT object_key FROM job_files WHERE job_id=%s AND role='upload'",
                (abandoned["jobId"],),
            ).fetchone()
            db.execute(
                "UPDATE conversion_jobs SET upload_expires_at=now()-interval '30 seconds' WHERE id=%s",
                (abandoned["jobId"],),
            )
        # Expired signed grants no longer occupy per-IP/global admission slots.
        replacement = create(c)
        assert replacement["jobId"] != abandoned["jobId"]
        cleanup()
        with connect() as db:
            still_pending = db.execute(
                "SELECT state,purged_at FROM conversion_jobs WHERE id=%s",
                (abandoned["jobId"],),
            ).fetchone()
        assert still_pending["state"] == "UPLOADING" and still_pending["purged_at"] is None
        assert storage.client().head_object(Bucket=settings.bucket, Key=uploaded["object_key"])
        with connect() as db:
            db.execute(
                "UPDATE conversion_jobs SET upload_expires_at=now()-interval '91 seconds' WHERE id=%s",
                (abandoned["jobId"],),
            )
        cleanup()
        with connect() as db:
            row = db.execute(
                "SELECT state,purged_at FROM conversion_jobs WHERE id=%s",
                (abandoned["jobId"],),
            ).fetchone()
            file = db.execute(
                "SELECT purged_at FROM job_files WHERE job_id=%s AND role='upload'",
                (abandoned["jobId"],),
            ).fetchone()
        assert row["state"] == "EXPIRED" and row["purged_at"]
        assert file["purged_at"]
        with pytest.raises(ClientError):
            storage.client().head_object(Bucket=settings.bucket, Key=uploaded["object_key"])


def test_duplicate_finalize_and_queue_delivery():
    with client() as c:
        job = create(c, behavior="delay")
        upload(job)
        finalize(c, job)
        finalize(c, job)
        for _ in range(4):
            process.apply_async(args=[job["jobId"]])
        wait(c, job)
        with connect() as db:
            assert (
                db.execute(
                    "SELECT attempts FROM conversion_jobs WHERE id=%s", (job["jobId"],)
                ).fetchone()["attempts"]
                == 1
            )
            assert (
                db.execute(
                    "SELECT count(*) AS n FROM job_files WHERE job_id=%s AND role='output'",
                    (job["jobId"],),
                ).fetchone()["n"]
                == 1
            )


def test_multiple_queued_jobs_complete_with_single_worker_and_resource_bounds():
    job_count = 3
    worker = service("worker")
    worker.reload()
    host_config = worker.attrs["HostConfig"]
    assert host_config["Memory"] == 256 * 1024 * 1024
    assert host_config["PidsLimit"] == 64
    assert "--concurrency=1" in worker.attrs["Config"]["Cmd"]

    with ExitStack() as stack:
        clients = [stack.enter_context(client()) for _ in range(job_count)]

        def submit(c):
            job = create(c, behavior="delay")
            upload(job)
            finalize(c, job)
            return job

        with ThreadPoolExecutor(max_workers=job_count) as pool:
            jobs = list(pool.map(submit, clients))

        deadline = time.monotonic() + 60
        queue_observed = False
        peak_worker_memory = 0
        statuses = [None] * job_count
        while time.monotonic() < deadline:
            for index, (c, job) in enumerate(zip(clients, jobs, strict=True)):
                response = c.get(f"/api/v1/jobs/{job['jobId']}")
                assert response.status_code == 200, response.text
                statuses[index] = response.json()
            states = [status["state"] for status in statuses]
            queue_observed |= "PROCESSING" in states and "QUEUED" in states
            worker.reload()
            stats = worker.stats(stream=False)
            memory_stats = stats.get("memory_stats", {})
            peak_worker_memory = max(peak_worker_memory, memory_stats.get("usage", 0))
            assert not worker.attrs["State"].get("OOMKilled", False)
            if all(state == "COMPLETED" for state in states):
                break
            assert not any(state in {"FAILED", "CANCELLED", "EXPIRED"} for state in states), states
            time.sleep(0.2)
        else:
            pytest.fail(f"Queued jobs did not drain: {[s['state'] for s in statuses]}")

        assert queue_observed, (
            f"No queued work observed with a single worker: {[s['state'] for s in statuses]}"
        )
        assert peak_worker_memory > 0
        assert peak_worker_memory < host_config["Memory"]
        for c, job, status in zip(clients, jobs, statuses, strict=True):
            assert download(c, job, status) == b"%FN-RESULT\nPROJECT OWNED EXAMPLE"


def test_upload_replay_cannot_modify_validated_input():
    with client() as c:
        job = create(c, behavior="delay")
        upload(job)
        finalize(c, job)
        changed = DATA.replace(b"example", b"changed")
        assert len(changed) == len(DATA)
        upload(job, changed)
        assert download(c, job, wait(c, job)) == b"%FN-RESULT\nPROJECT OWNED EXAMPLE"


def test_oversize_invalid_content_and_unsigned_storage_denied():
    with client() as c:
        job = create(c)
        signed = job["uploads"][0]
        assert httpx.put(
            signed["url"], content=DATA + b"x", headers=signed["headers"]
        ).status_code in (400, 403)
        with connect() as db:
            key = db.execute(
                "SELECT object_key FROM job_files WHERE job_id=%s", (job["jobId"],)
            ).fetchone()["object_key"]
        assert httpx.get(settings.s3_public + "/" + settings.bucket + "/" + key).status_code == 403
        storage.write(key, b"x" * (settings.max_bytes + 1))
        assert (
            c.post(f"/api/v1/jobs/{job['jobId']}/complete-upload").json()["error"]
            == "FILE_TOO_LARGE"
        )
        storage.write(key, b"x" * len(DATA))
        assert (
            c.post(f"/api/v1/jobs/{job['jobId']}/complete-upload").json()["error"] == "CORRUPT_FILE"
        )


def test_storage_signature_tampering_and_expiry():
    key = storage.object_key("upload")
    storage.write(key, DATA)
    url = storage.sign_download(key, 1)
    assert httpx.get(url.replace(key, storage.object_key("upload"))).status_code == 403
    time.sleep(2)
    expired = httpx.get(url)
    assert expired.status_code == 400
    assert b"<Code>InvalidRequest</Code>" in expired.content
    assert b"<Message>Bad request: Date is too old</Message>" in expired.content
    assert DATA not in expired.content
    storage.remove(key)


@pytest.mark.parametrize("action", ["cancel", "delete"])
def test_cancellation_race_never_publishes_output(action):
    with client() as c:
        job = create(c, behavior="delay")
        upload(job)
        finalize(c, job)
        wait(c, job, "PROCESSING")
        path = f"/api/v1/jobs/{job['jobId']}"
        response = c.delete(path) if action == "delete" else c.post(path + "/cancel")
        assert response.status_code == 200
        time.sleep(5)
        assert c.get(path).json()["state"] == ("EXPIRED" if action == "delete" else "CANCELLED")
        assert c.get(path).json()["files"] == []
        process.apply_async(args=[job["jobId"]])
        assert c.post(path + "/complete-upload").status_code in (409, 410)


@pytest.mark.parametrize(
    "behavior,code",
    [
        ("timeout", "CONVERSION_TIMEOUT"),
        ("memory", "RESOURCE_LIMIT"),
        ("invalid-output", "INVALID_OUTPUT"),
        ("large-output", "RESOURCE_LIMIT"),
    ],
)
def test_real_sandbox_failure_paths(behavior, code):
    with client() as c:
        job = create(c, behavior=behavior)
        upload(job)
        finalize(c, job)
        assert wait(c, job, "FAILED")["error"] == code
        assert c.get(f"/api/v1/jobs/{job['jobId']}").json()["files"] == []


def test_sandbox_restrictions_actually_enforced():
    with client() as c:
        job = create(c, behavior="probe")
        upload(job)
        finalize(c, job)
        result = json.loads(download(c, job, wait(c, job)))
        assert result["uid"] == 10001
        assert result["cpu_throttled"] is True
        for name in [
            "readonly",
            "network_blocked",
            "capabilities_dropped",
            "no_new_privileges",
            "pids_enforced",
            "scratch_bounded",
        ]:
            assert result[name] is True, (name, result)
        assert result["socket"] is False
        assert result["memory_max"] == str(64 * 1024 * 1024)
        assert result["pids_max"] == "16"
        quota, period = map(int, result["cpu_max"].split())
        assert quota / period == 0.5
        assert not any(
            any(word in name for word in ("SECRET", "PASSWORD", "DATABASE", "REDIS", "S3_"))
            for name in result["environment"]
        )
        engine = docker.from_env()
        assert (
            engine.containers.list(all=True, filters={"label": "filenimble.sandbox=local-phase5"})
            == []
        )


def test_worker_crash_and_expired_lease_recovery():
    worker = service("worker")
    with client() as c:
        job = create(c, behavior="delay")
        upload(job)
        finalize(c, job)
        wait(c, job, "PROCESSING")
        try:
            worker.kill()
            time.sleep(1)
            with connect() as db:
                db.execute(
                    "UPDATE conversion_jobs SET lease_until=now()-interval '1 second' WHERE id=%s",
                    (job["jobId"],),
                )
            recover()
        finally:
            worker.start()
        wait(c, job, timeout=45)
        with connect() as db:
            row = db.execute(
                "SELECT attempts FROM conversion_jobs WHERE id=%s", (job["jobId"],)
            ).fetchone()
            assert row["attempts"] >= 2
            assert (
                db.execute(
                    "SELECT count(*) AS n FROM job_files WHERE job_id=%s AND role='output'",
                    (job["jobId"],),
                ).fetchone()["n"]
                == 1
            )


def test_redis_outage_does_not_lose_committed_jobs():
    broker = service("redis")
    with client() as c:
        try:
            broker.stop(timeout=2)
            job = create(c)
            upload(job)
            finalize(c, job)
            time.sleep(3)
            assert c.get(f"/api/v1/jobs/{job['jobId']}").json()["state"] == "QUEUED"
        finally:
            broker.start()
        wait(c, job, timeout=45)


def test_cleanup_failure_is_recorded_and_retried():
    store = service("storage")
    with client() as c:
        job = create(c)
        upload(job)
        try:
            store.stop(timeout=2)
            c.delete(f"/api/v1/jobs/{job['jobId']}")
            with connect() as db:
                db.execute(
                    "UPDATE conversion_jobs SET upload_expires_at=now()-interval '1 second' WHERE id=%s",
                    (job["jobId"],),
                )
            cleanup()
            with connect() as db:
                row = db.execute(
                    "SELECT cleanup_failures,purged_at FROM conversion_jobs WHERE id=%s",
                    (job["jobId"],),
                ).fetchone()
                assert row["cleanup_failures"] > 0 and row["purged_at"] is None
        finally:
            store.start()
        storage_client = storage.client()
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                storage_client.head_bucket(Bucket=settings.bucket)
                break
            except Exception:
                time.sleep(0.25)
        else:
            pytest.fail("Object storage did not become ready after restart")
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            cleanup()
            with connect() as db:
                purged_at = db.execute(
                    "SELECT purged_at FROM conversion_jobs WHERE id=%s", (job["jobId"],)
                ).fetchone()["purged_at"]
            if purged_at:
                break
            time.sleep(0.25)
        else:
            pytest.fail("Cleanup did not purge the job after storage became ready")


def _attempt_job_creation(c, _):
    return c.post(
        "/api/v1/jobs",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "tool": "__fixture__",
            "files": [{"name": "x", "size": len(DATA), "type": "application/octet-stream"}],
        },
    ).status_code


def test_atomic_concurrency_quota_and_request_rate():
    # Start without an existing per-IP job so the race measures the full cap of two.
    with client() as c:
        with ThreadPoolExecutor(max_workers=6) as pool:
            outcomes = list(pool.map(lambda index: _attempt_job_creation(c, index), range(6)))
        assert outcomes.count(201) == 2
        assert outcomes.count(429) == 4
        with connect() as db:
            db.execute("UPDATE quota_windows SET requests=600 WHERE subject LIKE 'request-%%'")
        assert c.get("/api/v1/jobs/" + str(uuid4())).status_code == 429


def test_input_checksum_tampering_is_rejected():
    worker = service("worker")
    with client() as c:
        try:
            worker.stop(timeout=3)
            job = create(c)
            upload(job)
            finalize(c, job)
            with connect() as db:
                key = db.execute(
                    "SELECT object_key FROM job_files WHERE job_id=%s AND role='input'",
                    (job["jobId"],),
                ).fetchone()["object_key"]
            storage.write(key, b"tampered")
        finally:
            worker.start()
        assert wait(c, job, "FAILED")["error"] == "CORRUPT_FILE"


def test_metrics_are_content_free():
    with client() as c:
        response = c.get("/metrics")
        assert response.status_code == 200
        assert "filenimble_jobs" in response.text
        assert "filenimble_heartbeat_age_seconds" in response.text
        assert "project owned example" not in response.text
        assert settings.internal_secret not in response.text


def test_transient_runner_failure_has_bounded_retries():
    supervisor = service("supervisor")
    with client() as c:
        try:
            supervisor.stop(timeout=2)
            job = create(c)
            upload(job)
            finalize(c, job)
            assert wait(c, job, "FAILED", timeout=45)["error"] == "SERVICE_UNAVAILABLE"
            with connect() as db:
                row = db.execute(
                    "SELECT attempts FROM conversion_jobs WHERE id=%s", (job["jobId"],)
                ).fetchone()
                assert row["attempts"] == settings.max_attempts
                assert (
                    db.execute(
                        "SELECT count(*) AS n FROM job_files WHERE job_id=%s AND role='output'",
                        (job["jobId"],),
                    ).fetchone()["n"]
                    == 0
                )
        finally:
            supervisor.start()


def test_orphan_storage_cleanup_and_abandoned_upload():
    from dataclasses import replace
    from app import lifecycle

    key = storage.object_key("input")
    storage.write(key, DATA)
    time.sleep(2)
    original = lifecycle.settings
    try:
        lifecycle.settings = replace(settings, retention=1)
        lifecycle.sweep_orphans()
    finally:
        lifecycle.settings = original
    with pytest.raises(ClientError):
        storage.client().head_object(Bucket=settings.bucket, Key=key)
    with client() as c:
        job = create(c)
        upload(job)
        with connect() as db:
            db.execute(
                "UPDATE conversion_jobs SET expires_at=now()-interval '1 second',upload_expires_at=now()-interval '1 second' WHERE id=%s",
                (job["jobId"],),
            )
        cleanup()
        assert c.get(f"/api/v1/jobs/{job['jobId']}").json()["state"] == "EXPIRED"
        assert c.post(f"/api/v1/jobs/{job['jobId']}/complete-upload").status_code == 410


def test_byte_quota_reservation_is_atomic():
    with client() as c:
        create(c)
        with connect() as db:
            db.execute(
                "UPDATE quota_windows SET bytes=%s WHERE subject LIKE 'bytes-owner:%%'",
                (10 * settings.max_bytes - len(DATA),),
            )

        def attempt(_):
            return c.post(
                "/api/v1/jobs",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "tool": "__fixture__",
                    "files": [{"name": "x", "size": len(DATA), "type": "application/octet-stream"}],
                },
            ).status_code

        with ThreadPoolExecutor(max_workers=4) as pool:
            outcomes = list(pool.map(attempt, range(4)))
        assert outcomes.count(201) == 1
        assert outcomes.count(429) == 3


def test_api_schema_and_body_bounds():
    with client() as c:
        job = create(c)
        cookie = c.cookies.get("fn_session")
        assert cookie and len(cookie) > 100
        response = c.post("/api/v1/jobs", content=b"x" * 16385)
        assert response.status_code == 413
        response = c.post(
            "/api/v1/jobs",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "tool": "__fixture__",
                "files": [{"name": "../secret", "size": 1, "type": "application/octet-stream"}],
            },
        )
        assert response.status_code == 422
        assert "../secret" not in response.text
        assert (
            c.post(
                f"/api/v1/jobs/{job['jobId']}/download-token",
                json={"fileId": str(uuid4()), "unexpected": True},
            ).status_code
            == 422
        )


def test_queue_contains_identifiers_only_and_expired_lease_cannot_renew():
    import base64
    import redis
    from app.lifecycle import dispatch
    from app.tasks import renew

    worker = service("worker")
    with client() as c:
        try:
            worker.stop(timeout=3)
            job = create(c)
            upload(job)
            finalize(c, job)
            dispatch()
            with redis.Redis.from_url(settings.redis) as broker:
                messages = [json.loads(raw) for raw in broker.lrange("celery", 0, -1)]
            bodies = [json.loads(base64.b64decode(message["body"])) for message in messages]
            matches = [body for body in bodies if body[0] == [job["jobId"]]]
            assert matches
            assert all(body[1] == {} for body in matches)
            assert all(DATA.decode() not in json.dumps(message) for message in messages)
            run_id = uuid4()
            with connect() as db:
                db.execute(
                    "UPDATE conversion_jobs SET state='PROCESSING',run_id=%s,lease_until=now()-interval '1 second' WHERE id=%s",
                    (run_id, job["jobId"]),
                )
            assert renew(job["jobId"], str(run_id)) is False
            c.delete(f"/api/v1/jobs/{job['jobId']}")
        finally:
            worker.start()


def test_confirmed_purge_metadata_retention():
    with client() as c:
        job = create(c)
        c.delete(f"/api/v1/jobs/{job['jobId']}")
        with connect() as db:
            db.execute(
                "UPDATE conversion_jobs SET upload_expires_at=now()-interval '1 second' WHERE id=%s",
                (job["jobId"],),
            )
        cleanup()
        with connect() as db:
            row = db.execute(
                "SELECT purged_at FROM conversion_jobs WHERE id=%s", (job["jobId"],)
            ).fetchone()
            assert row["purged_at"]
            db.execute(
                "UPDATE conversion_jobs SET purged_at=now()-interval '8 days' WHERE id=%s",
                (job["jobId"],),
            )
        cleanup()
        with connect() as db:
            assert (
                db.execute("SELECT id FROM conversion_jobs WHERE id=%s", (job["jobId"],)).fetchone()
                is None
            )
            assert (
                db.execute("SELECT id FROM job_files WHERE job_id=%s", (job["jobId"],)).fetchone()
                is None
            )

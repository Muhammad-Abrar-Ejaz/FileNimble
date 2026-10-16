from contextlib import contextmanager
from datetime import datetime, timezone

from app import monitor_snapshot


class Result:
    def __init__(self, one=None, many=None):
        self.one, self.many = one, many or []

    def fetchone(self):
        return self.one

    def fetchall(self):
        return self.many


class Database:
    def execute(self, query, _params=None):
        if "FROM conversion_jobs" in query:
            return Result(
                one={
                    "active": 2,
                    "queued": 1,
                    "oldest_queued_seconds": 17,
                    "cleanup_failed": 0,
                }
            )
        if "FROM job_attempts" in query:
            return Result(one={"failures": 0})
        if "FROM service_heartbeats" in query:
            now = datetime.now(timezone.utc)
            return Result(
                many=[
                    {"name": "worker", "age_seconds": 4, "seen_at": now},
                    {"name": "lifecycle", "age_seconds": 3, "seen_at": now},
                ]
            )
        raise AssertionError("Unexpected monitoring query")


def test_monitor_snapshot_returns_only_bounded_health_and_counter_fields(monkeypatch):
    @contextmanager
    def connection():
        yield Database()

    class Storage:
        def head_bucket(self, **_kwargs):
            return {}

    monkeypatch.setattr(monitor_snapshot, "connect", connection)
    monkeypatch.setattr(monitor_snapshot.storage, "client", lambda: Storage())
    monkeypatch.setattr(monitor_snapshot.celery.control, "ping", lambda timeout: [{"ok": "pong"}])
    snapshot = monitor_snapshot.collect()

    assert snapshot == {
        "database_healthy": True,
        "storage_healthy": True,
        "worker_healthy": True,
        "lifecycle_healthy": True,
        "active_jobs": 2,
        "queued_jobs": 1,
        "oldest_queued_seconds": 17,
        "recent_conversion_failures": 0,
        "pending_cleanup_failures": 0,
    }

"""Private, bounded monitoring snapshot for the Oracle host watchdog.

Run with ``python -m app.monitor_snapshot`` inside the API container. There is no
HTTP route: only the host-side watchdog can invoke this module through Compose.
The output contains booleans and bounded counters only, never credentials,
object names, client identifiers, hostnames, or exception messages.
"""

import json
import sys

from app import storage
from app.config import settings
from app.db import connect
from app.jobs import ACTIVE
from app.tasks import celery


def collect():
    with connect() as db:
        jobs = db.execute(
            """SELECT
                 count(*) FILTER (WHERE state=ANY(%s) AND expires_at>now()
                   AND deleted_at IS NULL AND (state!='UPLOADING' OR upload_expires_at>now())) AS active,
                 count(*) FILTER (WHERE state='QUEUED' AND expires_at>now()
                   AND deleted_at IS NULL) AS queued,
                 coalesce(extract(epoch FROM now()-min(created_at)
                   FILTER (WHERE state='QUEUED' AND expires_at>now()
                     AND deleted_at IS NULL)),0)::integer AS oldest_queued_seconds,
                 count(*) FILTER (WHERE cleanup_failures>0 AND purged_at IS NULL) AS cleanup_failed
               FROM conversion_jobs""",
            (list(ACTIVE),),
        ).fetchone()
        attempts = db.execute(
            "SELECT count(*) AS failures FROM job_attempts WHERE finished_at>=now()-interval '10 minutes' AND outcome!='completed'"
        ).fetchone()
        heartbeats = db.execute(
            "SELECT name,extract(epoch FROM now()-seen_at)::integer AS age_seconds FROM service_heartbeats WHERE name=ANY(%s)",
            (["worker", "lifecycle"],),
        ).fetchall()
    heartbeat_age = {row["name"]: row["age_seconds"] for row in heartbeats}
    worker_ping = bool(celery.control.ping(timeout=2))
    storage.client().head_bucket(Bucket=settings.bucket)
    return {
        "database_healthy": True,
        "storage_healthy": True,
        "worker_healthy": worker_ping and heartbeat_age.get("worker", 10**9) <= 90,
        "lifecycle_healthy": heartbeat_age.get("lifecycle", 10**9) <= 90,
        "active_jobs": min(int(jobs["active"]), 1000),
        "queued_jobs": min(int(jobs["queued"]), 1000),
        "oldest_queued_seconds": min(int(jobs["oldest_queued_seconds"]), 86400),
        "recent_conversion_failures": min(int(attempts["failures"]), 1000),
        "pending_cleanup_failures": min(int(jobs["cleanup_failed"]), 1000),
    }


if __name__ == "__main__":
    try:
        print(json.dumps(collect(), separators=(",", ":")))
    except Exception:
        print("Monitoring snapshot unavailable; private service health check failed.")
        sys.exit(1)

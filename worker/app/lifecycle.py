import logging
import time

from app import storage
from app.config import settings
from app.db import connect, counter, heartbeat
from app.jobs import now
from app.tasks import process

logger = logging.getLogger("lifecycle")


def dispatch():
    with connect() as db:
        rows = db.execute(
            "SELECT id FROM conversion_jobs WHERE state='QUEUED' AND dispatch_at<=now() AND expires_at>now() AND deleted_at IS NULL AND (dispatched_at IS NULL OR dispatched_at<now()-interval '10 seconds') FOR UPDATE SKIP LOCKED LIMIT 10"
        ).fetchall()
        for row in rows:
            try:
                process.apply_async(args=[str(row["id"])], retry=False)
            except Exception:
                counter("dispatch_failures")
                continue
            db.execute("UPDATE conversion_jobs SET dispatched_at=now() WHERE id=%s", (row["id"],))


def recover():
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM conversion_jobs WHERE state='PROCESSING' AND lease_until<now() FOR UPDATE SKIP LOCKED"
        ).fetchall()
        for job in rows:
            retry = (
                job["attempts"] < settings.max_attempts
                and job["expires_at"] > now()
                and not job["deleted_at"]
            )
            db.execute(
                "UPDATE job_attempts SET finished_at=now(),outcome='lease_expired',error_code='WORKER_LOST' WHERE run_id=%s",
                (job["run_id"],),
            )
            db.execute(
                "UPDATE conversion_jobs SET state=%s,lease_until=NULL,run_id=NULL,dispatch_at=now(),dispatched_at=NULL,error_code=%s,cleanup_after=CASE WHEN %s THEN NULL ELSE now() END WHERE id=%s",
                (
                    "QUEUED" if retry else "FAILED",
                    None if retry else "RESOURCE_LIMIT",
                    retry,
                    job["id"],
                ),
            )
            counter("lease_recoveries")


def cleanup():
    with connect() as db:
        db.execute(
            "UPDATE conversion_jobs SET state='EXPIRED',cleanup_after=now() WHERE expires_at<=now() AND state NOT IN ('EXPIRED','CANCELLED','FAILED')"
        )
        rows = db.execute(
            "SELECT * FROM conversion_jobs WHERE purged_at IS NULL AND (expires_at<=now() OR deleted_at IS NOT NULL OR cleanup_after<=now()) FOR UPDATE SKIP LOCKED LIMIT 20"
        ).fetchall()
        for job in rows:
            try:
                files = db.execute(
                    "SELECT * FROM job_files WHERE job_id=%s", (job["id"],)
                ).fetchall()
                for file in files:
                    storage.remove(file["object_key"])
                    db.execute("UPDATE job_files SET purged_at=now() WHERE id=%s", (file["id"],))
                # Upload grants remain reusable until their expiry; sweep again after that point.
                if job["upload_expires_at"] <= now():
                    db.execute(
                        "UPDATE conversion_jobs SET purged_at=now() WHERE id=%s", (job["id"],)
                    )
            except Exception:
                db.execute(
                    "UPDATE conversion_jobs SET cleanup_failures=cleanup_failures+1 WHERE id=%s",
                    (job["id"],),
                )
                counter("cleanup_failures")
        # Inputs no longer needed after completion, even though output has its own retention.
        for file in db.execute(
            "SELECT f.* FROM job_files f JOIN conversion_jobs j ON j.id=f.job_id WHERE j.state='COMPLETED' AND f.role!='output' AND f.purged_at IS NULL AND j.upload_expires_at<=now() FOR UPDATE OF f SKIP LOCKED"
        ):
            storage.remove(file["object_key"])
            db.execute("UPDATE job_files SET purged_at=now() WHERE id=%s", (file["id"],))
        db.execute(
            "DELETE FROM quota_windows WHERE window_id<%s AND subject LIKE 'request-%%'",
            (int(time.time()) // 60 - 60,),
        )
        db.execute(
            "DELETE FROM quota_windows WHERE window_id<%s AND subject LIKE 'bytes-%%'",
            (int(time.time()) // 86400 - 2,),
        )
        db.execute(
            "DELETE FROM quota_windows WHERE window_id<%s AND subject LIKE 'ai-minute-%%'",
            (int(time.time()) // 60 - 60,),
        )
        db.execute(
            "DELETE FROM quota_windows WHERE window_id<%s AND subject LIKE 'ai-daily-%%'",
            (int(time.time()) // 86400 - 2,),
        )
        # Retain minimal troubleshooting/idempotency metadata for seven days after confirmed purge.
        retired = [
            row["id"]
            for row in db.execute(
                "SELECT id FROM conversion_jobs WHERE purged_at<now()-interval '7 days' FOR UPDATE SKIP LOCKED LIMIT 100"
            )
        ]
        if retired:
            db.execute("DELETE FROM job_attempts WHERE job_id=ANY(%s)", (retired,))
            db.execute("DELETE FROM job_files WHERE job_id=ANY(%s)", (retired,))
            db.execute("DELETE FROM conversion_jobs WHERE id=ANY(%s)", (retired,))


def sweep_orphans():
    with connect() as db:
        keys = {
            r["object_key"]
            for r in db.execute("SELECT object_key FROM job_files WHERE purged_at IS NULL")
        }
    for page in storage.client().get_paginator("list_objects_v2").paginate(Bucket=settings.bucket):
        for obj in page.get("Contents", []):
            if (
                obj["Key"] not in keys
                and (now() - obj["LastModified"]).total_seconds() > settings.retention
            ):
                storage.remove(obj["Key"])
                counter("orphan_objects_deleted")


def main():
    settings.validate()
    tick = 0
    while True:
        for operation in (recover, dispatch, cleanup):
            try:
                operation()
            except Exception:
                logger.error("lifecycle_operation_failed operation=%s", operation.__name__)
        try:
            heartbeat("lifecycle")
            if tick % 30 == 0:
                sweep_orphans()
        except Exception:
            logger.error("lifecycle_maintenance_failed")
        tick += 1
        time.sleep(1)


if __name__ == "__main__":
    main()

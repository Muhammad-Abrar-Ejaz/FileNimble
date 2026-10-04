import hashlib
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from app.config import settings


def connect():
    return psycopg.connect(settings.database, row_factory=dict_row, connect_timeout=5)


def migrate():
    with connect() as db:
        db.execute("SELECT pg_advisory_xact_lock(5080)")
        db.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, hash text NOT NULL)"
        )
        for path in sorted(Path("migrations").glob("*.sql")):
            sql = path.read_text()
            digest = hashlib.sha256(sql.encode()).hexdigest()
            row = db.execute(
                "SELECT hash FROM schema_migrations WHERE name=%s", (path.name,)
            ).fetchone()
            if row:
                if row["hash"] != digest:
                    raise RuntimeError("Applied migration checksum changed")
                continue
            db.execute(sql)
            db.execute("INSERT INTO schema_migrations VALUES (%s,%s)", (path.name, digest))


def counter(name):
    with connect() as db:
        db.execute(
            "INSERT INTO platform_counters VALUES (%s,1) ON CONFLICT(name) DO UPDATE SET value=platform_counters.value+1",
            (name,),
        )


def heartbeat(name):
    with connect() as db:
        db.execute(
            "INSERT INTO service_heartbeats VALUES (%s,now()) ON CONFLICT(name) DO UPDATE SET seen_at=now()",
            (name,),
        )


if __name__ == "__main__":
    migrate()

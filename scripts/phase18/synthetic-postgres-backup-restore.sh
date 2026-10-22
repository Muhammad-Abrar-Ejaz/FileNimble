#!/usr/bin/env bash
set -Eeuo pipefail

# Isolated qualification of the documented active-beta PostgreSQL path:
# pg_dump custom format, schema plus schema_migrations data only, then pg_restore
# into a fresh instance. No production backup script, credentials, data, or host
# configuration is used here.

if [[ "${1:-}" == "--client" ]]; then
  set +x
  source_db=source
  restore_db=restore
  user="${POSTGRES_USER:?}"
  db="${POSTGRES_DB:?}"
  schema_fixture=/workspace/worker/tests/capacity/fixtures/verified-empty-schema.sql
  expected_fixture_hash=dac30e622281bac92c6cab7858367e088acdbad3966949e5dc8359021df416a8
  migration=/workspace/worker/migrations/001_platform.sql
  expected_migration_hash=56124ebc4bab31d1dffe1ef962fb76909fca8e963f8497dac87f1cdddf0c76f0
  package=/test/package
  archive="$package/postgres.dump"
  listing=/test/restore-list.txt

  fixture_hash="$(tr -d '\r' < "$schema_fixture" | sha256sum | awk '{print $1}')"
  [[ "$fixture_hash" == "$expected_fixture_hash" ]] || { echo 'BLOCKED: reviewed schema fixture digest differs'; exit 1; }
  echo "Verified reviewed schema fixture hash ($expected_fixture_hash)."

  migration_hash="$(tr -d '\r' < "$migration" | sha256sum | awk '{print $1}')"
  [[ "$migration_hash" == "$expected_migration_hash" ]] || { echo 'BLOCKED: reviewed migration digest differs'; exit 1; }
  echo "Verified migration artifact digest ($expected_migration_hash); migration code is not run."

  for host in "$source_db" "$restore_db"; do
    ready=false
    for _ in $(seq 1 60); do
      if pg_isready -q -h "$host" -U "$user" -d "$db"; then ready=true; break; fi
      sleep 1
    done
    [[ "$ready" == true ]] || { echo "FAIL: isolated PostgreSQL readiness on host $host"; exit 1; }
  done
  echo "PostgreSQL instances ($source_db, $restore_db) are ready."

  # Initialize only a disposable database from the reviewed static schema fixture.
  # Do not invoke the application's migration runner or execute migration files.
  # The schema fixture creates all 7 tables (including schema_migrations).
  # The sole ledger row is synthetic and records the reviewed runtime-normalized digest.
  echo "Initializing synthetic source database from reviewed static schema fixture..."
  psql -X -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -f "$schema_fixture" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" <<SQL >/dev/null
INSERT INTO public.schema_migrations VALUES ('001_platform.sql', '$expected_migration_hash');
INSERT INTO public.conversion_jobs (id,owner_hash,ip_hash,capability,state,options,request_hash,idempotency_key,source_bytes,expires_at,upload_expires_at)
VALUES ('00000000-0000-4000-8000-000000000001','SYNTHETIC_OWNER','SYNTHETIC_IP','tar-to-zip','COMPLETED','{}','SYNTHETIC_REQUEST','SYNTHETIC_IDEMPOTENCY',12,now()+interval '1 hour',now()+interval '1 hour');
INSERT INTO public.job_files (id,job_id,role,object_key,media_type,bytes,expires_at)
VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','input','SYNTHETIC_OBJECT_SENTINEL','application/x-tar',12,now()+interval '1 hour');
INSERT INTO public.job_attempts (run_id,job_id,outcome)
VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','SYNTHETIC_SUCCESS');
INSERT INTO public.quota_windows VALUES ('SYNTHETIC_SUBJECT',1,1,12);
INSERT INTO public.service_heartbeats VALUES ('SYNTHETIC_SERVICE',now());
INSERT INTO public.platform_counters VALUES ('SYNTHETIC_COUNTER',1);
SQL

  expected_tables=$'conversion_jobs\njob_attempts\njob_files\nplatform_counters\nquota_windows\nschema_migrations\nservice_heartbeats'
  actual_tables="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
  [[ "$actual_tables" == "$expected_tables" ]] || { echo 'FAIL: unexpected source table allowlist'; exit 1; }
  source_counts="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT (SELECT count(*) FROM conversion_jobs)||'|'||(SELECT count(*) FROM job_attempts)||'|'||(SELECT count(*) FROM job_files)||'|'||(SELECT count(*) FROM quota_windows)||'|'||(SELECT count(*) FROM service_heartbeats)||'|'||(SELECT count(*) FROM platform_counters)||'|'||(SELECT count(*) FROM schema_migrations)")"
  [[ "$source_counts" == '1|1|1|1|1|1|1' ]] || { echo 'FAIL: synthetic source fixture'; exit 1; }
  echo "Synthetic source database initialized: 7 tables, 1 row each (including ledger)."

  echo "Generating custom-format backup with ephemeral table data excluded..."
  mkdir -m 700 "$package"
  pg_dump -h "$source_db" -U "$user" -d "$db" --format=custom --no-owner --no-privileges \
    --exclude-table-data=public.conversion_jobs \
    --exclude-table-data=public.job_attempts \
    --exclude-table-data=public.job_files \
    --exclude-table-data=public.quota_windows \
    --exclude-table-data=public.service_heartbeats \
    --exclude-table-data=public.platform_counters \
    --file="$archive"
  [[ -s "$archive" && "$(head -c 5 "$archive")" == 'PGDMP' ]] || { echo 'FAIL: custom-format dump'; exit 1; }
  [[ "$(stat -c '%s' "$archive")" -le 33554432 ]] || { echo 'FAIL: dump exceeds documented size cap'; exit 1; }
  pg_restore --list "$archive" > "$listing"
  grep -Eq 'TABLE DATA[[:space:]]+public[[:space:]]+schema_migrations' "$listing" || { echo 'FAIL: ledger data absent from package'; exit 1; }
  if grep -Eq 'TABLE DATA[[:space:]]+public[[:space:]]+(conversion_jobs|job_attempts|job_files|quota_windows|service_heartbeats|platform_counters)([[:space:]]|$)' "$listing"; then
    echo 'FAIL: ephemeral table data present in package'; exit 1
  fi
  [[ "$(find "$package" -mindepth 1 -maxdepth 1 -type f -printf '%f\n')" == 'postgres.dump' ]] || { echo 'FAIL: unexpected package member'; exit 1; }
  echo "Backup dump verified: PGDMP custom format, ledger data present, all 6 ephemeral tables excluded."

  catalog_fingerprint() {
    local target="$1"
    {
      psql -X -At -v ON_ERROR_STOP=1 -h "$target" -U "$user" -d "$db" -c \
        "SELECT 'TABLE', tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
      psql -X -At -v ON_ERROR_STOP=1 -h "$target" -U "$user" -d "$db" -c \
        "SELECT 'COLUMN', table_name, column_name, data_type, is_nullable, coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name;"
      psql -X -At -v ON_ERROR_STOP=1 -h "$target" -U "$user" -d "$db" -c \
        "SELECT 'CONSTRAINT', conname, contype::text, conrelid::regclass::text, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY conname;"
      psql -X -At -v ON_ERROR_STOP=1 -h "$target" -U "$user" -d "$db" -c \
        "SELECT 'INDEX', tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;"
    } | sha256sum | awk '{print $1}'
  }

  echo "Restoring backup package into fresh disposable database..."
  pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -h "$restore_db" -U "$user" -d "$db" "$archive"

  echo "Verifying restored catalog, columns, constraints, and indexes..."
  source_tables="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
  restored_tables="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
  [[ "$source_tables" == "$restored_tables" ]] || { echo 'FAIL: restored tables mismatch'; exit 1; }

  source_cols="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT table_name||'.'||column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position")"
  restored_cols="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT table_name||'.'||column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position")"
  [[ "$source_cols" == "$restored_cols" ]] || { echo 'FAIL: restored columns mismatch'; exit 1; }

  source_constraints="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT conname||'|'||contype::text||'|'||conrelid::regclass::text||'|'||pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY conname")"
  restored_constraints="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT conname||'|'||contype::text||'|'||conrelid::regclass::text||'|'||pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY conname")"
  [[ "$source_constraints" == "$restored_constraints" ]] || { echo 'FAIL: restored constraints mismatch'; exit 1; }

  source_indexes="$(psql -X -At -v ON_ERROR_STOP=1 -h "$source_db" -U "$user" -d "$db" -c "SELECT indexname||'|'||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")"
  restored_indexes="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT indexname||'|'||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")"
  [[ "$source_indexes" == "$restored_indexes" ]] || { echo 'FAIL: restored indexes mismatch'; exit 1; }

  echo "Comparing sanitized schema-only DDL outputs between source and restored instances..."
  pg_dump -h "$source_db" -U "$user" -d "$db" --schema-only --no-owner --no-privileges | grep -v -E '^(\\(restrict|unrestrict)|--|[[:space:]]*$)' > /test/source_schema.sql
  pg_dump -h "$restore_db" -U "$user" -d "$db" --schema-only --no-owner --no-privileges | grep -v -E '^(\\(restrict|unrestrict)|--|[[:space:]]*$)' > /test/restore_schema.sql

  if cmp -s /test/source_schema.sql /test/restore_schema.sql; then
    echo "Sanitized pg_dump schema DDL matches 100% byte-for-byte across all statements."
  else
    echo "Demonstrating raw pg_dump statement ordering difference:"
    diff -u /test/source_schema.sql /test/restore_schema.sql || true
    sort /test/source_schema.sql > /test/source_schema_sorted.sql
    sort /test/restore_schema.sql > /test/restore_schema_sorted.sql
    diff -u /test/source_schema_sorted.sql /test/restore_schema_sorted.sql || {
      echo "FAIL: substantive schema DDL mismatch found"; exit 1;
    }
    echo "Sanitized pg_dump DDL contents match 100% (raw difference is strictly statement ordering)."
  fi

  echo "Verifying deterministic catalog fingerprint..."
  source_catalog_sha="$(catalog_fingerprint "$source_db")"
  restored_catalog_sha="$(catalog_fingerprint "$restore_db")"
  [[ "$source_catalog_sha" == "$restored_catalog_sha" ]] || { echo 'FAIL: restored catalog fingerprint mismatch'; exit 1; }
  echo "Schema verified: 100% match across tables, columns, constraints, indexes, sorted DDL, and deterministic catalog fingerprint ($source_catalog_sha)."

  echo "Verifying restored migration ledger row..."
  ledger="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT count(*)||'|'||coalesce(bool_and(name='001_platform.sql' AND hash='$expected_migration_hash')::text,'false') FROM schema_migrations")"
  [[ "$ledger" == '1|true' ]] || { echo 'FAIL: restored migration ledger'; exit 1; }
  echo "Migration ledger verified: 1 row, name=001_platform.sql, hash matches expected runtime digest."

  echo "Verifying that ephemeral operational rows were excluded..."
  restored_counts="$(psql -X -At -v ON_ERROR_STOP=1 -h "$restore_db" -U "$user" -d "$db" -c "SELECT (SELECT count(*) FROM conversion_jobs)||'|'||(SELECT count(*) FROM job_attempts)||'|'||(SELECT count(*) FROM job_files)||'|'||(SELECT count(*) FROM quota_windows)||'|'||(SELECT count(*) FROM service_heartbeats)||'|'||(SELECT count(*) FROM platform_counters)||'|'||(SELECT count(*) FROM schema_migrations)")"
  [[ "$restored_counts" == '0|0|0|0|0|0|1' ]] || { echo 'FAIL: restored operational-row exclusions'; exit 1; }
  echo "Exclusions verified: conversion_jobs=0, job_attempts=0, job_files=0, quota_windows=0, service_heartbeats=0, platform_counters=0, schema_migrations=1."

  dump_sha="$(sha256sum "$archive" | awk '{print $1}')"
  dump_bytes="$(stat -c '%s' "$archive")"
  printf 'QUALIFICATION PASS: schema=PASS ledger=PASS excluded_operational_rows=PASS package_allowlist=PASS dump_bytes=%s dump_sha256=%s\n' "$dump_bytes" "$dump_sha"
  rm -rf "$package" "$listing" /test/source_schema*.sql /test/restore_schema*.sql
  exit 0
fi

command -v docker >/dev/null || { echo 'BLOCKED: Docker is required'; exit 1; }
repo="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}"
runner_temp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
scratch="$(mktemp -d "$runner_temp/filenimble-pg-qualification.XXXXXX")"
chmod 700 "$scratch"
label="com.filenimble.phase18.pg-qualification=${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-$$"
suffix="${GITHUB_RUN_ID:-local}-$$"
network="fn-pg-qualify-$suffix"
source_name="fn-pg-source-$suffix"
restore_name="fn-pg-restore-$suffix"
env_file="$scratch/postgres.env"
password="$(openssl rand -hex 32)"
cat > "$env_file" <<EOF
POSTGRES_USER=phase18_synthetic
POSTGRES_PASSWORD=$password
POSTGRES_DB=phase18_synthetic
PGUSER=phase18_synthetic
PGPASSWORD=$password
PGDATABASE=phase18_synthetic
EOF
chmod 600 "$env_file"
unset password

cleanup() {
  for name in "$source_name" "$restore_name"; do
    if docker inspect "$name" >/dev/null 2>&1; then
      found="$(docker inspect --format '{{ index .Config.Labels "com.filenimble.phase18.pg-qualification" }}' "$name" 2>/dev/null || true)"
      [[ "$found" != "$label" ]] || docker rm -f "$name" >/dev/null
    fi
  done
  if docker network inspect "$network" >/dev/null 2>&1; then
    found="$(docker network inspect --format '{{ index .Labels "com.filenimble.phase18.pg-qualification" }}' "$network" 2>/dev/null || true)"
    [[ "$found" != "$label" ]] || docker network rm "$network" >/dev/null
  fi
  docker run --rm --user 0:0 -v "$scratch:/test:rw" postgres:17 find /test -mindepth 1 -delete 2>/dev/null || true
  case "$scratch" in
    "$runner_temp"/filenimble-pg-qualification.*)
      rm -rf -- "$scratch"
      [[ ! -e "$scratch" ]] || { echo 'FAIL: scratch directory cleanup'; exit 1; }
      echo "Temporary scratch directory and container resources cleanly removed."
      ;;
    *)
      echo 'WARNING: refusing unexpected temp cleanup path' >&2
      ;;
  esac
}
trap cleanup EXIT

docker pull postgres:17 >/dev/null
docker network create --internal --label "com.filenimble.phase18.pg-qualification=$label" "$network" >/dev/null
for name in "$source_name" "$restore_name"; do
  docker run -d --name "$name" --label "com.filenimble.phase18.pg-qualification=$label" \
    --network "$network" --network-alias "$([[ "$name" == "$source_name" ]] && echo source || echo restore)" \
    --env-file "$env_file" --memory=512m --memory-swap=512m --cpus=1 --pids-limit=128 \
    --read-only --tmpfs /var/lib/postgresql/data:rw,size=192m \
    --tmpfs /var/run/postgresql:rw,size=8m --tmpfs /tmp:rw,size=16m postgres:17 >/dev/null
done

docker run --rm --network "$network" --env-file "$env_file" \
  -v "$repo:/workspace:ro" -v "$scratch:/test:rw" postgres:17 \
  bash /workspace/scripts/phase18/synthetic-postgres-backup-restore.sh --client

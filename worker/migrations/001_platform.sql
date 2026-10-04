CREATE TABLE conversion_jobs (
 id uuid PRIMARY KEY, owner_hash text NOT NULL, ip_hash text NOT NULL,
 capability text NOT NULL, state text NOT NULL CHECK (state IN
 ('CREATED','UPLOADING','VALIDATING','QUEUED','PROCESSING','COMPLETED','EXPIRED','FAILED','CANCELLED')),
 options jsonb NOT NULL, request_hash text NOT NULL, idempotency_key text NOT NULL,
 source_bytes bigint NOT NULL CHECK (source_bytes > 0), output_bytes bigint,
 attempts integer NOT NULL DEFAULT 0, run_id uuid, lease_until timestamptz,
 dispatch_at timestamptz, dispatched_at timestamptz, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz,
 completed_at timestamptz, expires_at timestamptz NOT NULL, upload_expires_at timestamptz NOT NULL,
 deleted_at timestamptz, cleanup_after timestamptz, purged_at timestamptz,
 cleanup_failures integer NOT NULL DEFAULT 0, worker_version text,
 UNIQUE(owner_hash,idempotency_key)
);
CREATE INDEX jobs_dispatch ON conversion_jobs(state,dispatch_at);
CREATE INDEX jobs_expiry ON conversion_jobs(expires_at);
CREATE TABLE job_files (
 id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES conversion_jobs(id),
 role text NOT NULL CHECK (role IN ('upload','input','output')),
 object_key text NOT NULL UNIQUE, media_type text NOT NULL,
 bytes bigint NOT NULL DEFAULT 0, checksum text, expires_at timestamptz NOT NULL,
 purged_at timestamptz, UNIQUE(job_id,role)
);
CREATE TABLE job_attempts (
 run_id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES conversion_jobs(id),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 outcome text, error_code text
);
CREATE TABLE quota_windows (
 subject text NOT NULL, window_id bigint NOT NULL, requests integer NOT NULL DEFAULT 0,
 bytes bigint NOT NULL DEFAULT 0, PRIMARY KEY(subject,window_id)
);
CREATE TABLE service_heartbeats (name text PRIMARY KEY, seen_at timestamptz NOT NULL);
CREATE TABLE platform_counters (name text PRIMARY KEY, value bigint NOT NULL DEFAULT 0);

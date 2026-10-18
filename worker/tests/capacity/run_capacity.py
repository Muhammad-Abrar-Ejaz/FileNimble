"""Approved isolated capacity orchestration. Never runs migrations."""

import hashlib
import json
import os
import secrets
import shutil
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
FIX = ROOT / "fixtures"
PG = "postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"
RUN = "fn17cap-" + uuid.uuid4().hex[:10]
NAMESPACE = "phase15-qualification-" + RUN
GIT = shutil.which("git")
if GIT is None:
    raise RuntimeError("git_not_found")
DOCKER = shutil.which("docker")
if DOCKER is None:
    raise RuntimeError("docker_not_found")
REVISION = subprocess.run(  # noqa: S603
    [GIT, "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True
).stdout.strip()
BACK = "filenimble-capacity-backend:" + REVISION[:12] + "-" + RUN
ARCHIVE = "filenimble-archive:" + RUN
CREATED = []
IMAGES = []
SERVICE_CPUSET = "0,1"
CLIENT_CPUSET = "2,3"
REPORT = {
    "run": RUN,
    "revision": REVISION,
    "results": {},
    "network": "internal",
    "migrations_executed": False,
    "production_endpoints_used": False,
}
ENV = {
    k: secrets.token_hex(32)
    for k in [
        "POSTGRES_PASSWORD",
        "REDIS_PASSWORD",
        "JOB_TOKEN_SECRET",
        "CONVERSION_API_SECRET",
        "RUNNER_SECRET",
        "TRANSFER_TOKEN_SECRET",
        "S3_SECRET_ACCESS_KEY",
    ]
}
ENV["S3_ACCESS_KEY_ID"] = "GK" + secrets.token_hex(16)


def cli(*args, data=None, check=True, timeout=120, env=None, cwd=None):
    process_env = {
        k: v
        for k, v in os.environ.items()
        if k
        in {
            "PATH",
            "HOME",
            "DOCKER_HOST",
            "DOCKER_CONTEXT",
            "DOCKER_CONFIG",
            "RUNNER_TEMP",
            "GITHUB_STEP_SUMMARY",
        }
    }
    if env:
        process_env.update(env)
    # CLI arguments are assembled by this test harness from fixed test data.
    p = subprocess.run(  # noqa: S603
        [DOCKER, *args],
        input=data,
        capture_output=True,
        timeout=timeout,
        env=process_env,
        cwd=cwd,
    )
    if check and p.returncode:
        error = p.stderr.decode(errors="replace").lower()
        category = next(
            (
                k
                for k in [
                    "read-only",
                    "no such file",
                    "could not find",
                    "permission denied",
                    "not found",
                ]
                if k in error
            ),
            "unknown",
        )
        if args[0] == "exec":
            REPORT["exec_failure_program"] = next(
                (x for x in args if x in ["psql", "pg_dump", "pg_isready"]), "other"
            )
            REPORT["exec_failure_flags"] = {
                x: (x in error)
                for x in [
                    "no such file",
                    "socket",
                    "not running",
                    "executable",
                    "database",
                    "connection",
                    "fatal",
                    "oci runtime",
                ]
            }
        raise RuntimeError("docker_" + args[0] + "_failed_" + category)
    return p


def create(
    service,
    image,
    command=(),
    env=None,
    mem="256m",
    network=None,
    extra=(),
    secure=True,
    cpuset=None,
    cpus="0.5",
):
    name = RUN + "-" + service
    args = [
        "create",
        "--name",
        name,
        "--label",
        "filenimble.capacity=" + RUN,
        "--network",
        network or RUN,
        "--memory",
        mem,
        "--memory-swap",
        mem,
        "--cpus",
        cpus,
        "--cpuset-cpus",
        cpuset or SERVICE_CPUSET,
        "--pids-limit",
        "64",
        "--log-driver",
        "none",
    ]
    if network != "none":
        args += ["--network-alias", service]
    if secure:
        args += [
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,nodev,size=160m",  # noqa: S108
        ]
    process_env = {
        k: v
        for k, v in os.environ.items()
        if k
        in {
            "PATH",
            "HOME",
            "DOCKER_HOST",
            "DOCKER_CONTEXT",
            "DOCKER_CONFIG",
            "RUNNER_TEMP",
            "GITHUB_STEP_SUMMARY",
        }
    }
    for k, v in (env or {}).items():
        process_env[k] = v
        args += ["--env", k]
    cli(*args, *extra, image, *command, env=process_env)
    CREATED.append(name)
    return name


def start(name):
    cli("start", name)


def sql(name, query):
    return (
        cli(
            "exec",
            "-i",
            name,
            "psql",
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "filenimble",
            "-d",
            "filenimble",
            "-At",
            data=query.encode(),
        )
        .stdout.decode()
        .strip()
    )


def dump(name):
    b = cli(
        "exec",
        name,
        "pg_dump",
        "-U",
        "filenimble",
        "-d",
        "filenimble",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
    ).stdout
    # pg_dump 17 may generate a random psql restrict token; normalize only those wrapper lines.
    return (
        b"\n".join(
            x for x in b.splitlines() if not x.startswith((b"\\restrict ", b"\\unrestrict "))
        )
        + b"\n"
    )


def pg(service, network="none"):
    name = create(
        service,
        PG,
        env={
            "POSTGRES_USER": "filenimble",
            "POSTGRES_DB": "filenimble",
            "POSTGRES_PASSWORD": ENV["POSTGRES_PASSWORD"],
        },
        mem="256m",
        network=network,
        secure=False,
        extra=[
            "--tmpfs",
            "/var/lib/postgresql/data:rw,size=512m",
            "--tmpfs",
            "/var/run/postgresql:rw,size=16m",
        ],
    )
    start(name)
    for _ in range(60):
        if (
            cli(
                "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "filenimble", check=False
            ).returncode
            == 0
        ):
            return name
        time.sleep(1)
    raise RuntimeError("postgres_not_ready")


def load_fixture():
    manifest = json.loads((FIX / "verified-manifest.json").read_text())
    exported = (FIX / "verified-empty-schema.sql").read_bytes()
    assert manifest["result"] == "PASS" and manifest["migrations_executed"] is False
    assert manifest["ledger_rows"] == 0 and manifest["rows"] == 0 and manifest["tables"] == 7
    assert hashlib.sha256(exported).hexdigest() == manifest["schema_dump_sha256"]
    restored = pg("fixture-restore")
    sql(restored, exported.decode())
    assert dump(restored) == exported
    for statement in [
        "SELECT count(*) FROM conversion_jobs",
        "SELECT count(*) FROM job_attempts",
        "SELECT count(*) FROM job_files",
        "SELECT count(*) FROM platform_counters",
        "SELECT count(*) FROM quota_windows",
        "SELECT count(*) FROM schema_migrations",
        "SELECT count(*) FROM service_heartbeats",
    ]:
        assert sql(restored, statement) == "0"
    REPORT["fixture"] = {
        **manifest,
        "result": "PASS",
        "postgres_image": PG,
        "restore_catalog_match": True,
        "run_rows": 0,
    }
    cli("rm", "-f", restored)
    CREATED.remove(restored)
    return exported


def main():
    global SERVICE_CPUSET, CLIENT_CPUSET
    import platform
    import shutil

    if platform.machine().lower() not in {"aarch64", "arm64"}:
        raise RuntimeError("runner_architecture_not_arm64")
    if os.cpu_count() is None or os.cpu_count() < 4:
        raise RuntimeError("runner_cpu_below_minimum")
    available = (
        sorted(os.sched_getaffinity(0))
        if hasattr(os, "sched_getaffinity")
        else list(range(os.cpu_count() or 0))
    )
    if len(available) < 4:
        raise RuntimeError("runner_cpu_affinity_below_minimum")
    SERVICE_CPUSET = ",".join(map(str, available[:2]))
    CLIENT_CPUSET = ",".join(map(str, available[2:4]))
    REPORT["runner"] = {
        "architecture": platform.machine(),
        "cpu_count": os.cpu_count(),
        "cpu_affinity_count": len(available),
        "service_cpuset": SERVICE_CPUSET,
        "client_cpuset": CLIENT_CPUSET,
        "memory_total_bytes": int(
            Path("/proc/meminfo").read_text().split("MemTotal:")[1].split()[0]
        )
        * 1024,
        "disk_before_bytes": shutil.disk_usage(REPO).free,
        "host_oom_kill_before": int(
            next(
                (
                    line.split()[1]
                    for line in Path("/proc/vmstat").read_text().splitlines()
                    if line.startswith("oom_kill ")
                ),
                "0",
            )
        ),
    }
    images = [
        PG,
        "redis@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499",
        "dxflrs/garage@sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690",
    ]
    for image in images:
        cli("pull", image, timeout=300)
    cli("build", "--pull", "-f", "worker/Dockerfile", "-t", BACK, ".", cwd=REPO, timeout=900)
    IMAGES.append(BACK)
    cli(
        "build",
        "--pull",
        "-f",
        "worker/engines/Archive.Dockerfile",
        "-t",
        ARCHIVE,
        ".",
        cwd=REPO,
        timeout=900,
    )
    IMAGES.append(ARCHIVE)
    REPORT["images_built_from_revision"] = REVISION
    REPORT["runner"]["disk_after_images_bytes"] = shutil.disk_usage(REPO).free
    exported = load_fixture()
    cli("network", "create", "--internal", "--label", "filenimble.capacity=" + RUN, RUN)
    db = pg("postgres", RUN)
    sql(db, exported.decode())
    before = dump(db)
    assert before == exported and sql(db, "select count(*) from schema_migrations") == "0"
    env = {
        **ENV,
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql://filenimble:"
        + ENV["POSTGRES_PASSWORD"]
        + "@postgres/filenimble",
        "REDIS_URL": "redis://:" + ENV["REDIS_PASSWORD"] + "@redis:6379/0",
        "RUNNER_URL": "http://supervisor:8001",
        "S3_ENDPOINT": "http://storage:3900",
        "S3_PUBLIC_ENDPOINT": "http://storage:3900",
        "S3_REGION": "garage",
        "S3_BUCKET": "filenimble",
        "PRODUCTION_CONVERSIONS_ENABLED": "true",
        "PRODUCTION_TOOL_ALLOWLIST": "tar-to-zip,zip-to-tar",
        "ENABLE_TEST_CAPABILITY": "0",
        "ENABLE_NATIVE_QUALIFICATION": "0",
        "AI_ENABLED": "false",
        "TRANSFER_PUBLIC_URL": "https://api.example.org",
        "SITE_ORIGIN": "https://site.example.org",
        "RUNNER_NAMESPACE": NAMESPACE,
        "PHASE15_DISPOSABLE": "1",
        "CAPACITY_FOCUSED_CLEANUP": os.getenv("CAPACITY_FOCUSED_CLEANUP", "0"),
        "CAPACITY_FOCUSED_DISABLED": os.getenv("CAPACITY_FOCUSED_DISABLED", "0"),
    }
    redis = create(
        "redis",
        "redis@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499",
        [
            "sh",
            "-c",
            'exec redis-server --save "" --appendonly no --maxmemory 64mb --maxmemory-policy noeviction --requirepass "$REDIS_PASSWORD"',
        ],
        env={"REDIS_PASSWORD": ENV["REDIS_PASSWORD"]},
        mem="128m",
        secure=False,
        extra=["--tmpfs", "/data:rw,size=128m"],
    )
    start(redis)
    # Synthetic config only, transported through stdin tar; no host secret files.
    import io
    import tarfile

    config = (
        'metadata_dir="/var/lib/garage/meta"\ndata_dir="/var/lib/garage/data"\ndb_engine="sqlite"\nreplication_factor=1\n'
        'rpc_bind_addr="[::]:3901"\nrpc_public_addr="127.0.0.1:3901"\nrpc_secret="'
        + secrets.token_hex(32)
        + '"\n'
        '[s3_api]\ns3_region="garage"\napi_bind_addr="[::]:3900"\n'
    ).encode()

    def copy_bytes(name, dest, filename, data):
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tar:
            info = tarfile.TarInfo(filename)
            info.size = len(data)
            info.mode = 0o644
            tar.addfile(info, io.BytesIO(data))
        cli("cp", "-", name + ":" + dest, data=buf.getvalue())

    storage = create(
        "storage",
        "dxflrs/garage@sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690",
        ["/garage", "-c", "/garage.toml", "server", "--single-node", "--default-bucket"],
        env={
            "RUST_LOG": "warn",
            "GARAGE_DEFAULT_ACCESS_KEY": ENV["S3_ACCESS_KEY_ID"],
            "GARAGE_DEFAULT_SECRET_KEY": ENV["S3_SECRET_ACCESS_KEY"],
            "GARAGE_DEFAULT_BUCKET": "filenimble",
        },
        mem="256m",
        secure=False,
        extra=["--tmpfs", "/var/lib/garage:rw,size=512m"],
    )
    copy_bytes(storage, "/", "garage.toml", config)
    start(storage)
    bootstrap = create("bootstrap", BACK, ["python", "-m", "app.bootstrap"], env=env)
    cli("start", "-a", bootstrap)
    cli("rm", bootstrap)
    CREATED.remove(bootstrap)
    # Instrument only the disposable backend image to pin child sandboxes to
    # Oracle's two-core envelope; repository production source stays untouched.
    original = (REPO / "worker/app/native_runner.py").read_bytes()
    needle = b"            nano_cpus=1_000_000_000,"
    assert original.count(needle) == 1
    patched = original.replace(
        needle, needle + b'\n            cpuset_cpus="' + SERVICE_CPUSET.encode() + b'",'
    )
    image_expression = b'f"filenimble-{family}:phase11"'
    assert patched.count(image_expression) == 1
    patched = patched.replace(
        image_expression,
        b'os.getenv("CAPACITY_ARCHIVE_IMAGE", "filenimble-archive:phase11") if family == "archive" else "filenimble-media:phase11"',
    )
    compile(patched.decode(), "native_runner.py", "exec")
    import tempfile

    with tempfile.TemporaryDirectory(prefix="fn-capacity-image-") as td:
        context = Path(td)
        (context / "native_runner.py").write_bytes(patched)
        (context / "Dockerfile").write_text(
            "FROM " + BACK + "\nCOPY native_runner.py /app/app/native_runner.py\n"
        )
        bounded = BACK + "-bounded"
        cli("build", "-t", bounded, str(context), timeout=180)
        IMAGES.append(bounded)
    testimage = "filenimble-capacity-harness:" + RUN
    (ROOT / "Dockerfile.harness").write_text(
        "FROM "
        + bounded
        + "\nCOPY worker/tests/capacity/capacity_harness.py /app/capacity_harness.py\n"
    )
    cli(
        "build",
        "-f",
        "worker/tests/capacity/Dockerfile.harness",
        "-t",
        testimage,
        ".",
        cwd=REPO,
        timeout=180,
    )
    IMAGES.append(testimage)
    REPORT["sandbox_affinity"] = (
        SERVICE_CPUSET + " (test-image-only instrumentation; two Oracle-equivalent cores)"
    )
    for service, mem, command in [
        (
            "api",
            "256m",
            ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"],
        ),
        (
            "transfers",
            "256m",
            [
                "uvicorn",
                "app.transfers:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8002",
                "--no-access-log",
            ],
        ),
        (
            "worker",
            "256m",
            [
                "celery",
                "-A",
                "app.tasks",
                "worker",
                "--loglevel=WARNING",
                "--concurrency=1",
                "--hostname=worker@%h",
            ],
        ),
        ("lifecycle", "256m", ["python", "-m", "app.lifecycle"]),
    ]:
        start(create(service, bounded, command, env=env, mem=mem))
    supervisor_env = {
        "APP_ENV": "production",
        "RUNNER_SECRET": ENV["RUNNER_SECRET"],
        "RUNNER_NAMESPACE": NAMESPACE,
        "PRODUCTION_CONVERSIONS_ENABLED": "true",
        "PRODUCTION_TOOL_ALLOWLIST": "tar-to-zip,zip-to-tar",
        "CAPACITY_ARCHIVE_IMAGE": ARCHIVE,
    }
    supervisor = create(
        "supervisor",
        bounded,
        ["uvicorn", "app.supervisor:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"],
        env=supervisor_env,
        mem="256m",
        extra=["--volume", "/var/run/docker.sock:/var/run/docker.sock"],
    )
    start(supervisor)
    REPORT["supervisor"] = "PASS: ephemeral GitHub-hosted runner Docker daemon only"
    harness = create(
        "harness",
        testimage,
        ["python", "/app/capacity_harness.py"],
        env=env,
        mem="512m",
        cpuset=CLIENT_CPUSET,
        cpus="1.0",
    )
    print("ISOLATED_STACK_STARTED", flush=True)
    # Sample only exact owned containers, no raw logs/env or signed URLs.
    import threading

    stop = threading.Event()
    samples = []

    def sample():
        while not stop.is_set():
            ids = (
                cli("ps", "-q", "--filter", "label=filenimble.capacity=" + RUN, check=False)
                .stdout.decode()
                .split()
            )
            ids += (
                cli("ps", "-q", "--filter", "label=filenimble.sandbox=" + NAMESPACE, check=False)
                .stdout.decode()
                .split()
            )
            p = (
                cli("stats", "--no-stream", "--format", "{{json .}}", *ids, check=False, timeout=30)
                if ids
                else None
            )
            if p is None:
                stop.wait(1)
                continue
            for line in p.stdout.decode().splitlines():
                try:
                    samples.append(json.loads(line))
                except ValueError:
                    pass
            stop.wait(0.25)

    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    event_start = str(int(time.time()))
    p = cli("start", "-a", harness, check=False, timeout=900)
    stop.set()
    thread.join(35)
    # Harness emits only bounded sanitized JSON.
    try:
        REPORT["tests"] = json.loads(p.stdout)
    except ValueError:
        REPORT["tests"] = {
            "result": "FAIL",
            "category": "harness_output_invalid",
            "exit": p.returncode,
        }
    REPORT["samples"] = samples
    REPORT["schema_unchanged"] = dump(db) == before
    REPORT["ledger_rows"] = int(sql(db, "select count(*) from schema_migrations"))
    REPORT["database_bytes"] = int(sql(db, "select pg_database_size('filenimble')"))
    probe = "import json,pathlib,shutil; p=pathlib.Path('/sys/fs/cgroup'); d=shutil.disk_usage('/'); print(json.dumps({'cpu_stat':(p/'cpu.stat').read_text(),'memory_events':(p/'memory.events').read_text(),'pids_events':(p/'pids.events').read_text(),'memory_peak_bytes':int((p/'memory.peak').read_text()),'swap_max':(p/'memory.swap.max').read_text().strip(),'root_disk_total':d.total,'root_disk_free':d.free}))"
    REPORT["cgroups"] = {}
    for service in ["api", "transfers", "worker", "lifecycle"]:
        probe_result = cli("exec", RUN + "-" + service, "python", "-c", probe, check=False)
        if probe_result.returncode == 0:
            REPORT["cgroups"][service] = json.loads(probe_result.stdout)
    states = []
    for name in CREATED:
        v = json.loads(cli("inspect", name).stdout)[0]
        states.append(
            {
                "name": name,
                "running": v["State"]["Running"],
                "oom": v["State"]["OOMKilled"],
                "exit": v["State"]["ExitCode"],
                "memory": v["HostConfig"]["Memory"],
                "memory_swap": v["HostConfig"]["MemorySwap"],
                "nano_cpus": v["HostConfig"]["NanoCpus"],
            }
        )
    REPORT["states"] = states
    REPORT["runner"]["disk_after_tests_bytes"] = __import__("shutil").disk_usage(REPO).free
    REPORT["runner"]["host_oom_kill_after"] = int(
        next(
            (
                line.split()[1]
                for line in Path("/proc/vmstat").read_text().splitlines()
                if line.startswith("oom_kill ")
            ),
            "0",
        )
    )
    REPORT["runner"]["host_oom_kill_delta"] = (
        REPORT["runner"]["host_oom_kill_after"] - REPORT["runner"]["host_oom_kill_before"]
    )

    def memory_bytes(value):
        import re

        match = re.fullmatch(r"([0-9.]+)(B|KiB|MiB|GiB)", value.strip())
        return (
            int(
                float(match.group(1))
                * {"B": 1, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3}[match.group(2)]
            )
            if match
            else 0
        )

    REPORT["resource_measurements"] = {
        "docker_stats_samples": len(samples),
        "max_container_memory_usage_bytes": max(
            (memory_bytes(x.get("MemUsage", "0B").split("/")[0]) for x in samples), default=0
        ),
        "cpu_sample_percentages": [x.get("CPUPerc") for x in samples if x.get("CPUPerc")],
        "sandbox_memory_samples": [x for x in samples if x.get("Name", "").startswith("fn-job-")],
    }
    event_end = str(int(time.time()))
    oom_events = cli(
        "events",
        "--since",
        event_start,
        "--until",
        event_end,
        "--filter",
        "event=oom",
        "--filter",
        "label=filenimble.sandbox=" + NAMESPACE,
        "--format",
        "{{json .}}",
        check=False,
        timeout=10,
    )
    REPORT["sandbox_oom_event_count"] = len(
        [line for line in oom_events.stdout.decode().splitlines() if line.strip()]
    )
    REPORT["oom_event_probe"] = "PASS" if oom_events.returncode == 0 else "BLOCKED"
    expected_tests = {
        "service_health",
        "global_admission",
        "per_ip_race",
        "minute_rate",
        "hourly_quota",
        "four_real_conversions",
        "expired_upload_cleanup",
        "malformed_upload",
        "disabled_tools_auth",
        "final_cleanup",
    }
    REPORT["expected_test_gates_present"] = expected_tests.issubset(REPORT["tests"])
    REPORT["resource_limits_verified"] = all(
        x["memory"] == x["memory_swap"]
        and x["nano_cpus"] == (1_000_000_000 if x["name"].endswith("-harness") else 500_000_000)
        and not x["oom"]
        for x in states
    )
    REPORT["result"] = (
        "PASS"
        if p.returncode == 0
        and REPORT["expected_test_gates_present"]
        and REPORT["tests"].get("final_cleanup", {}).get("result") == "PASS"
        and all(
            v.get("result") == "PASS"
            for v in REPORT["tests"].values()
            if isinstance(v, dict) and "result" in v
        )
        and REPORT["schema_unchanged"]
        and REPORT["ledger_rows"] == 0
        and REPORT["resource_limits_verified"]
        and REPORT["oom_event_probe"] == "PASS"
        and REPORT["sandbox_oom_event_count"] == 0
        else "FAIL"
    )
    report = json.dumps(REPORT, indent=2)
    report_path = Path(
        os.environ.get("CAPACITY_REPORT_PATH", str(ROOT / "capacity-full-result.json"))
    )
    report_path.write_text(report + "\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        lines = [
            "## FileNimble isolated ARM64 capacity results",
            "",
            f"**Overall: {REPORT['result']}**",
            "",
            f"Runner architecture: `{REPORT['runner']['architecture']}`; runner vCPU count: {REPORT['runner']['cpu_count']}; service CPU set: {SERVICE_CPUSET}; external test driver CPU set: {CLIENT_CPUSET}.",
            "",
            "| Gate | Result | Time (s) | Evidence |",
            "|---|---:|---:|---|",
        ]
        for name, result in REPORT["tests"].items():
            if isinstance(result, dict):
                lines.append(
                    f"| {name} | {result.get('result', 'UNKNOWN')} | {result.get('elapsed_seconds', '—')} | `{json.dumps(result.get('evidence', result), separators=(',', ':'))[:400]}` |"
                )
        lines += [
            "",
            f"DB schema unchanged: {REPORT.get('schema_unchanged')}; migration ledger rows: {REPORT.get('ledger_rows')}; runner free disk before/after (bytes): {REPORT['runner']['disk_before_bytes']} / {REPORT['runner']['disk_after_tests_bytes']}.",
            "",
            "This ARM64 runner result does not establish Oracle-host capacity equivalence.",
        ]
        Path(summary).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        json.dumps({k: v for k, v in REPORT.items() if k not in ["samples", "states"]}), flush=True
    )
    if REPORT["result"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        REPORT["orchestrator_error"] = (
            type(error).__name__ + ":" + str(error)[:90]
            if isinstance(error, RuntimeError)
            else type(error).__name__
        )
        REPORT["result"] = "BLOCKED"
        print("CAPACITY_BLOCKED:" + REPORT["orchestrator_error"], flush=True)
    finally:
        for name in reversed(CREATED):
            cli("rm", "-f", name, check=False)
        # Namespace unique to this run; no existing resources qualify.
        p = cli("ps", "-aq", "--filter", "label=filenimble.sandbox=" + NAMESPACE, check=False)
        for identifier in p.stdout.decode().split():
            cli("rm", "-f", identifier, check=False)
        cli("network", "rm", RUN, check=False)
        for image in reversed(IMAGES):
            cli("image", "rm", "-f", image, check=False)
        try:
            (ROOT / "Dockerfile.harness").unlink(missing_ok=True)
        except OSError:
            pass
        REPORT["remaining_owned_containers"] = not bool(
            cli("ps", "-aq", "--filter", "label=filenimble.capacity=" + RUN, check=False)
            .stdout.decode()
            .strip()
        )
        report = json.dumps(REPORT, indent=2) + "\n"
        (ROOT / "capacity-full-result.json").write_text(report)
        report_path = Path(
            os.environ.get("CAPACITY_REPORT_PATH", str(ROOT / "capacity-full-result.json"))
        )
        report_path.write_text(report)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            tests = REPORT.get("tests", {})
            lines = [
                "## FileNimble isolated ARM64 capacity results",
                "",
                f"**Overall: {REPORT.get('result', 'BLOCKED')}**",
            ]
            runner = REPORT.get("runner", {})
            if runner:
                lines += [
                    "",
                    f"Runner architecture: `{runner.get('architecture', 'unknown')}`; runner vCPU count: {runner.get('cpu_count', 'unknown')}; service CPU set: {SERVICE_CPUSET}; external test driver CPU set: {CLIENT_CPUSET}.",
                    "",
                    "| Gate | Result | Time (s) | Evidence |",
                    "|---|---:|---:|---|",
                ]
                for name, result in tests.items():
                    if isinstance(result, dict):
                        evidence = json.dumps(
                            result.get("evidence", result), separators=(",", ":")
                        )[:400]
                        lines.append(
                            f"| {name} | {result.get('result', 'UNKNOWN')} | {result.get('elapsed_seconds', '—')} | `{evidence}` |"
                        )
                lines += [
                    "",
                    f"Schema unchanged: {REPORT.get('schema_unchanged')}; migration ledger rows: {REPORT.get('ledger_rows', 'UNKNOWN')}; runner free disk before/after (bytes): {runner.get('disk_before_bytes', 'UNKNOWN')} / {runner.get('disk_after_tests_bytes', 'UNKNOWN')}.",
                    "",
                    "This ARM64 runner result does not establish Oracle-host capacity equivalence.",
                ]
            if REPORT.get("orchestrator_error"):
                lines += ["", f"Orchestrator status: `{REPORT['orchestrator_error']}`."]
            Path(summary).write_text("\n".join(lines) + "\n", encoding="utf-8")
        if REPORT.get("result") != "PASS":
            raise SystemExit(1)

"""On-host archive resource proof; trusted disposable harness only."""

import json
import os
from contextlib import closing

import docker
import pytest

pytestmark = [pytest.mark.integration, pytest.mark.production_integration]


def test_archive_actual_cgroup_limits_and_authority():
    assert os.getenv("PHASE15_DISPOSABLE") == "1"
    assert os.getenv("RUNNER_NAMESPACE", "").startswith("phase15-qualification-")
    script = """import os,json,socket
from pathlib import Path
assert os.getuid()==10001
assert Path('/sys/fs/cgroup/memory.max').read_text().strip()==str(128*1024*1024)
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0'
assert Path('/sys/fs/cgroup/pids.max').read_text().strip()=='64'
quota,period=map(int,Path('/sys/fs/cgroup/cpu.max').read_text().split())
assert quota==period
assert 'NoNewPrivs:\\t1' in Path('/proc/self/status').read_text()
assert 'CapEff:\\t0000000000000000' in Path('/proc/self/status').read_text()
assert not Path('/var/run/docker.sock').exists()
assert not any(k in os.environ for k in ['DATABASE_URL','REDIS_URL','RUNNER_SECRET','S3_SECRET_ACCESS_KEY'])
root=next(x.split() for x in Path('/proc/mounts').read_text().splitlines() if x.split()[1]=='/')
assert 'ro' in root[3].split(',')
for target in ['1.1.1.1','169.254.169.254','127.0.0.1']:
 s=socket.socket();s.settimeout(.2)
 try:
  s.connect((target,443));raise AssertionError('Network authority')
 except OSError: pass
 finally: s.close()
print(json.dumps({'limits_verified':True}))
"""
    with closing(docker.from_env()) as engine:
        output = engine.containers.run(
            "filenimble-archive:phase11",
            ["-c", script],
            entrypoint="python",
            user="10001:10001",
            remove=True,
            network_mode="none",
            read_only=True,
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit="128m",
            memswap_limit="128m",
            nano_cpus=1_000_000_000,
            pids_limit=64,
            tmpfs={
                "/work": "rw,noexec,nosuid,nodev,size=128m,uid=10001,gid=10001,mode=700",
                "/tmp": "rw,noexec,nosuid,nodev,size=32m,uid=10001,gid=10001,mode=700",  # noqa: S108 -- private per-container tmpfs.
            },
        )
    assert json.loads(output) == {"limits_verified": True}

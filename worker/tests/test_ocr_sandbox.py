import docker


def restricted(command, memory="512m"):
    engine = docker.from_env(timeout=10)
    container = engine.containers.create(
        "filenimble-ocr:phase7",
        entrypoint=["python", "-c"],
        command=[command],
        user="10001:10001",
        read_only=True,
        network_mode="none",
        cap_drop=["ALL"],
        security_opt=["no-new-privileges:true"],
        mem_limit=memory,
        memswap_limit=memory,
        nano_cpus=1_000_000_000,
        pids_limit=64,
        tmpfs={"/work": "rw,noexec,nosuid,nodev,size=256m,uid=10001,gid=10001,mode=700"},
    )
    try:
        container.start()
        result = container.wait(timeout=15)
        output = container.logs()
        # attrs is cached: refresh after log collection, matching the CLI/SDK diagnostic.
        container.reload()
        return (
            result["StatusCode"],
            output,
            container.attrs["State"].get("OOMKilled", False),
        )
    finally:
        container.remove(force=True)
        engine.close()


def test_ocr_image_actual_sandbox_boundary():
    code, output, _ = restricted("""import errno,os,socket
from pathlib import Path
assert os.getuid()==10001
assert not Path('/var/run/docker.sock').exists()
assert not any(name in os.environ for name in ['DATABASE_URL','S3_SECRET_ACCESS_KEY','RUNNER_SECRET'])
status=Path('/proc/self/status').read_text()
assert 'NoNewPrivs:\\t1' in status
assert 'CapEff:\\t0000000000000000' in status
assert Path('/sys/fs/cgroup/pids.max').read_text().strip()=='64'
assert Path('/sys/fs/cgroup/memory.max').read_text().strip()==str(512*1024*1024)
assert Path('/sys/fs/cgroup/cpu.max').read_text().split()==['100000','100000']
try: Path('/forbidden').write_text('x'); raise AssertionError('writable root')
except OSError as error: assert error.errno==errno.EROFS
try:
 socket.create_connection(('1.1.1.1',80),timeout=.1)
 raise AssertionError('network access')
except OSError: pass
print('sandbox verified')""")
    assert code == 0 and b"sandbox verified" in output


def test_ocr_image_memory_enforced():
    command = """import pathlib,re,subprocess,sys
events=pathlib.Path('/sys/fs/cgroup/memory.events')
maximum=pathlib.Path('/sys/fs/cgroup/memory.max').read_text().strip()
assert maximum==str(32*1024*1024), 'unexpected cgroup memory ceiling'
before=int(re.search(r'^oom_kill (\\d+)$',events.read_text(),re.M).group(1))
child=subprocess.run([sys.executable,'-c','data=bytearray(128*1024*1024); data[-1]=1'],capture_output=True)
after=int(re.search(r'^oom_kill (\\d+)$',events.read_text(),re.M).group(1))
assert child.returncode!=0, 'oversized allocation unexpectedly completed'
assert after>before or b'MemoryError' in child.stderr, 'memory ceiling did not reject allocation'
print('cgroup memory ceiling enforced')"""
    code, output, _ = restricted(command, memory="32m")
    assert code == 0 and b"cgroup memory ceiling enforced" in output


def test_real_tesseract_subprocess_timeout():
    code, output, _ = restricted("""import subprocess
from ocr import run
try:
 run(['--version'],timeout=0.000001)
 raise AssertionError('timeout was not enforced')
except subprocess.TimeoutExpired: print('timeout verified')""")
    assert code == 0 and b"timeout verified" in output

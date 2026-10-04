from contextlib import closing
import base64
import io
import json
import random
import wave
import zipfile

import docker
import pytest

from phase11_fixtures import archive, audio
from qualify_office import qualify


def webm(seconds=2, size="64x48", fps=10, with_audio=True):
    """A moving test chart with a sine wave, generated entirely inside a local test container."""
    args = [
        "/usr/local/bin/ffmpeg",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"testsrc2=size={size}:rate={fps}:duration={seconds}",
    ]
    if with_audio:
        args += [
            "-f",
            "lavfi",
            "-i",
            # Leave room for Vorbis encoder padding inside the exact video duration.
            f"sine=frequency=440:sample_rate=16000:duration={9.9 if seconds == 10 else seconds}",
            "-c:a",
            "vorbis",
            "-strict",
            "experimental",
            "-ac",
            "2",
        ]
    args += ["-threads", "1", "-c:v", "libvpx", "-b:v", "150k", "-y", "/work/fixture.webm"]
    # Docker's log transport is text-oriented; base64 preserves arbitrary media bytes.
    script = f"import subprocess,base64; subprocess.run({args!r},check=True,stdout=subprocess.DEVNULL);print(base64.b64encode(open('/work/fixture.webm','rb').read()).decode())"
    with closing(docker.from_env()) as engine:
        result = engine.containers.run(
            "filenimble-media:phase11",
            ["-c", script],
            entrypoint="python",
            remove=True,
            network_mode="none",
            read_only=True,
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit="256m",
            pids_limit=64,
            tmpfs={"/work": "size=64m,uid=10001,gid=10001,mode=700"},
        )
        return base64.b64decode(result, validate=False)


@pytest.mark.parametrize("rate,channels", [(8000, 1), (16000, 2), (48000, 2)])
def test_lossless_wav_flac_roundtrip(rate, channels):
    data = audio(rate=rate, channels=channels)
    flac = qualify("256m", "wav-to-flac", data, "media")
    wav = qualify("256m", "flac-to-wav", flac, "media")
    with wave.open(io.BytesIO(data)) as before, wave.open(io.BytesIO(wav)) as after:
        assert before.getparams() == after.getparams()
        assert before.readframes(before.getnframes()) == after.readframes(after.getnframes())


def test_audio_duration_boundary_and_rejection():
    qualify("256m", "wav-to-flac", audio(seconds=60, rate=48000, channels=2), "media")
    qualify("256m", "wav-to-flac", audio(seconds=61), "media", expect_error=True)
    qualify("256m", "wav-to-flac", audio(channels=3), "media", expect_error=True)
    qualify("256m", "wav-to-flac", audio(rate=96000), "media", expect_error=True)
    qualify("256m", "wav-to-flac", b"RIFF\0\0\0\0WAVEbad", "media", expect_error=True)
    qualify("256m", "flac-to-wav", b"fLaCmalformed", "media", expect_error=True)


def test_video_remux_extraction_frames():
    data = webm()
    muted = qualify("256m", "video-mute", data, "media")
    assert muted != data and b"\x1aE\xdf\xa3" == muted[:4]
    wav = qualify("256m", "video-to-wav", data, "media")
    with wave.open(io.BytesIO(wav)) as result:
        assert result.getnchannels() == 2 and result.getframerate() == 16000
        assert 1.9 < result.getnframes() / 16000 < 2.1
    frames = qualify("256m", "video-to-frames", data, "media")
    with zipfile.ZipFile(io.BytesIO(frames)) as result:
        assert result.namelist() == ["frame-000-at-0s.png", "frame-001-at-1s.png"]
        assert result.read(result.namelist()[0]) != result.read(result.namelist()[1])
        assert result.testzip() is None


def test_video_resource_boundaries():
    qualify("256m", "video-mute", webm(10, "640x360", 30), "media")
    for data in (webm(11), webm(size="642x360"), webm(fps=31), webm(with_audio=False)):
        qualify("256m", "video-mute", data, "media", expect_error=True)
    qualify("256m", "video-mute", b"\x1aE\xdf\xa3invalid", "media", expect_error=True)


@pytest.mark.parametrize("source,target", [("tar", "zip"), ("zip", "tar")])
def test_archive_sandbox_quality(source, target):
    result = qualify("128m", f"{source}-to-{target}", archive(source), "archive")
    assert result != archive(source)
    qualify(
        "128m",
        f"{source}-to-{target}",
        archive(source, {"../escape": b"x"}),
        "archive",
        expect_error=True,
    )


def test_archive_expansion_boundary():
    # Safe deterministic payload: 24 MiB expanded, below 10 MiB compressed, ratio below 100.
    generator = random.Random(170)
    block = b"".join(generator.randbytes(16384) * 32 for _ in range(16))
    entries = {f"file-{i}.bin": block for i in range(3)}
    qualify("128m", "zip-to-tar", archive("zip", entries), "archive")
    entries["over.txt"] = b"x"
    qualify("128m", "zip-to-tar", archive("zip", entries), "archive", expect_error=True)
    qualify(
        "128m", "tar-to-zip", archive("tar", {f"file-{i}.txt": b"x" for i in range(100)}), "archive"
    )


@pytest.mark.parametrize("family,memory", [("media", "256m"), ("archive", "128m")])
def test_phase11_sandbox_has_no_authority(family, memory):
    script = """import os,socket,json
assert os.getuid()==10001
assert not any(k in os.environ for k in ['DATABASE_URL','REDIS_URL','RUNNER_SECRET','S3_SECRET_ACCESS_KEY'])
assert not os.path.exists('/var/run/docker.sock')
assert 'NoNewPrivs:\\t1' in open('/proc/self/status').read()
assert 'CapEff:\\t0000000000000000' in open('/proc/self/status').read()
try:
 open('/escape','w')
 raise AssertionError('writable root')
except OSError: pass
s=socket.socket();s.settimeout(.2)
try:
 s.connect(('1.1.1.1',443))
 raise AssertionError('network enabled')
except OSError: pass
print(json.dumps({'ok':True}))
"""
    with closing(docker.from_env()) as engine:
        result = engine.containers.run(
            f"filenimble-{family}:phase11",
            ["-c", script],
            entrypoint="python",
            remove=True,
            network_mode="none",
            read_only=True,
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit=memory,
            memswap_limit=memory,
            nano_cpus=1_000_000_000,
            pids_limit=64,
            tmpfs={"/work": "size=128m,uid=10001,gid=10001,mode=700"},
        )
        assert json.loads(result)["ok"]

"""Exercise observation order without substituting for real cgroup qualification."""

from types import SimpleNamespace

import pytest

import test_ocr_sandbox as sandbox


@pytest.mark.parametrize("oom", [True, False])
def test_restricted_refreshes_state_after_logs_and_preserves_limits(monkeypatch, oom):
    events = []
    observed = {}

    class Container:
        attrs = {"State": {"OOMKilled": False}}
        logs_read = False

        def start(self):
            events.append("start")

        def wait(self, timeout):
            assert timeout == 15
            events.append("wait")
            return {"StatusCode": 137}

        def logs(self):
            events.append("logs")
            self.logs_read = True
            return b""

        def reload(self):
            events.append("reload")
            # Model a daemon flag becoming observable after the log request.
            self.attrs = {"State": {"OOMKilled": oom if self.logs_read else False}}

        def remove(self, force):
            assert force
            events.append("remove")

    def create(image, **kwargs):
        assert image == "filenimble-ocr:phase7"
        observed.update(kwargs)
        return Container()

    engine = SimpleNamespace(
        containers=SimpleNamespace(create=create), close=lambda: events.append("close")
    )
    monkeypatch.setattr(sandbox.docker, "from_env", lambda **_: engine)
    assert sandbox.restricted("data=bytearray(128*1024*1024)", memory="32m") == (137, b"", oom)
    assert events == ["start", "wait", "logs", "reload", "remove", "close"]
    assert observed["mem_limit"] == observed["memswap_limit"] == "32m"
    assert observed["network_mode"] == "none"
    assert observed["user"] == "10001:10001" and observed["read_only"]
    assert observed["cap_drop"] == ["ALL"]
    assert observed["security_opt"] == ["no-new-privileges:true"]
    assert observed["pids_limit"] == 64 and observed["nano_cpus"] == 1_000_000_000
    assert observed["tmpfs"] == {
        "/work": "rw,noexec,nosuid,nodev,size=256m,uid=10001,gid=10001,mode=700"
    }


def test_memory_security_check_does_not_accept_exit_137_without_oom(monkeypatch):
    monkeypatch.setattr(sandbox, "restricted", lambda *args, **kwargs: (137, b"", False))
    with pytest.raises(AssertionError):
        sandbox.test_ocr_image_memory_enforced()

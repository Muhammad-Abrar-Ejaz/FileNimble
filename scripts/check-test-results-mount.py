"""Validate the resolved CI test-report bind mount without printing config values."""

import json
import os
import sys
from pathlib import Path


config = json.load(sys.stdin)
expected_source = Path(".ci-test-results").resolve()
matches = [
    volume
    for volume in config.get("services", {}).get("tests", {}).get("volumes", [])
    if volume.get("target") == "/ci-test-results"
]

if len(matches) != 1:
    print("::error::Expected exactly one test-results bind mount at /ci-test-results.")
    raise SystemExit(1)

volume = matches[0]
source = Path(os.path.expandvars(volume.get("source", ""))).resolve()
if volume.get("type") != "bind" or source != expected_source or volume.get("read_only", False):
    print("::error::Resolved test-results mount must be the writable workspace bind.")
    raise SystemExit(1)

print("Resolved test-results bind: present, writable, and points at the job workspace.")

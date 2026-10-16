"""Validate the resolved CI test-report bind mount without printing config values."""

import json
import os
import sys
from pathlib import Path


try:
    config = json.load(sys.stdin)
except json.JSONDecodeError:
    print("::error::Compose did not emit valid JSON configuration.")
    raise SystemExit(1)

expected_source = Path(".ci-test-results").resolve()
matches = [
    volume
    for volume in config.get("services", {}).get("tests", {}).get("volumes", [])
    if volume.get("target") == "/ci-test-results"
]

if len(matches) != 1:
    print(f"::error::Resolved test-results mount count at /ci-test-results: {len(matches)} (expected 1).")
    raise SystemExit(1)

volume = matches[0]
source = Path(os.path.expandvars(volume.get("source", ""))).resolve()
is_bind = volume.get("type") == "bind"
source_matches = source == expected_source
writable = not volume.get("read_only", False)
print(
    "Resolved mount flags: "
    f"bind={str(is_bind).lower()}, workspace_source={str(source_matches).lower()}, "
    f"writable={str(writable).lower()}."
)
if not is_bind or not source_matches or not writable:
    print("::error::Resolved test-results mount does not match the writable workspace bind.")
    raise SystemExit(1)

print("Resolved test-results bind is valid.")

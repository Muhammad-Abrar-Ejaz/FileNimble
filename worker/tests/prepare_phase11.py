"""Generate small owned browser fixtures into an explicitly mounted /fixtures directory."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1]))
sys.path.insert(0, str(Path(__file__).parent))

from phase11_fixtures import archive, audio
from qualify_office import qualify
import test_phase11_engines


def fixtures():
    wav = audio()
    return {
        "input.wav": wav,
        "input.flac": qualify("256m", "wav-to-flac", wav, "media"),
        "input.webm": test_phase11_engines.webm(),
        "input.zip": archive("zip"),
        "input.tar": archive("tar"),
        "unsafe.zip": archive("zip", {"../escape.txt": b"rejected"}),
    }


if __name__ == "__main__":
    target = Path("/fixtures")
    for name, content in fixtures().items():
        (target / name).write_bytes(content)

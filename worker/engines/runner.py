"""Length-framed binary transport; document bytes never enter log channels."""

import json
import struct
import subprocess
import sys
from pathlib import Path

from validation import MAX_INPUT, validate_office, validate_pdf
from adapters import html, utility
from reverse import convert as reverse_convert
import data_converters


DATA_CONVERTERS = {
    "csv-to-xlsx": data_converters.csv_to_xlsx,
    "xlsx-to-csv": data_converters.xlsx_to_csv,
    "json-to-xlsx": data_converters.json_to_xlsx,
    "xlsx-to-json": data_converters.xlsx_to_json,
    "markdown-to-docx": data_converters.markdown_to_docx,
    "docx-to-markdown": data_converters.docx_to_markdown,
    "markdown-to-pdf": data_converters.markdown_to_pdf,
    "txt-to-pdf": data_converters.txt_to_pdf,
    "rtf-to-pdf": data_converters.rtf_to_pdf,
}


OFFICE = {"word-to-pdf": "docx", "powerpoint-to-pdf": "pptx", "excel-to-pdf": "xlsx"}


def read_exact(stream, size):
    result = bytearray()
    while len(result) < size:
        chunk = stream.read(min(65536, size - len(result)))
        if not chunk:
            raise ValueError("CORRUPT_FILE")
        result.extend(chunk)
    return result


def office(data, tool):
    extension = OFFICE[tool]
    validate_office(data, extension)
    source = Path("/work/input." + extension)
    source.write_bytes(data)
    profile = Path("/work/profile/user")
    profile.mkdir(parents=True)
    (profile / "registrymodifications.xcu").write_text("""<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item></oor:items>""")
    subprocess.run(  # noqa: S603 -- fixed executable/arguments and generated sandbox paths.
        [
            "/usr/bin/libreoffice",
            "-env:UserInstallation=file:///work/profile",
            "--headless",
            "--nologo",
            "--nodefault",
            "--norestore",
            "--convert-to",
            "pdf",
            "--outdir",
            "/work",
            str(source),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=90,
        check=True,
    )  # noqa: S603 -- fixed executable and generated sandbox paths; no shell.
    output = Path("/work/input.pdf")
    pages = validate_pdf(output)
    return output, {"pages": pages, "mediaType": "application/pdf"}


def main():
    try:
        stream = sys.stdin.buffer
        length = struct.unpack("!I", read_exact(stream, 4))[0]
        if not 0 < length <= 4096:
            raise ValueError("INVALID_REQUEST")
        metadata = json.loads(read_exact(stream, length))
        ocr_tool = metadata.get("tool") in {"image-to-text", "pdf-to-text", "ocr-pdf"}
        if set(metadata) != (
            {"tool", "size", "options"} if ocr_tool else {"tool", "size"}
        ) or metadata["tool"] not in {
            *OFFICE,
            *DATA_CONVERTERS,
            "html-to-pdf",
            "compress-pdf",
            "repair-pdf",
            "pdf-to-powerpoint",
            "pdf-to-excel",
            "image-to-text",
            "pdf-to-text",
            "ocr-pdf",
        }:
            raise ValueError("UNSUPPORTED_FORMAT")
        size = metadata["size"]
        if type(size) is not int or not 0 < size <= MAX_INPUT:
            raise ValueError("RESOURCE_LIMIT")
        data = read_exact(stream, size)
        tool = metadata["tool"]
        if ocr_tool:
            from ocr import convert as ocr_convert

            output, result = ocr_convert(data, tool, metadata["options"])
        elif tool in DATA_CONVERTERS:
            output, result = DATA_CONVERTERS[tool](data)
        elif tool in OFFICE:
            output, result = office(data, tool)
        elif tool == "html-to-pdf":
            output, result = html(data)
        elif tool in {"pdf-to-powerpoint", "pdf-to-excel"}:
            output, result = reverse_convert(data, tool)
        else:
            output, result = utility(data, tool)
        del data
        result["size"] = output.stat().st_size
        result["peakMemoryBytes"] = int(Path("/sys/fs/cgroup/memory.peak").read_text())
        header = json.dumps(result).encode()
        sys.stdout.buffer.write(struct.pack("!I", len(header)) + header)
        with output.open("rb") as source:
            while chunk := source.read(65536):
                sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()
    except Exception as error:
        # No raw parser messages, content, filenames or native stderr leave the sandbox.
        header = json.dumps({"error": type(error).__name__}).encode()
        sys.stdout.buffer.write(struct.pack("!I", len(header)) + header)
        sys.stdout.buffer.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()

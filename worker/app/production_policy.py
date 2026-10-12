"""Deployment scope intersects existing capability/licensing gates; empty means deny."""

import json
import os
from dataclasses import replace
from pathlib import Path

from app.capabilities import CAPABILITIES
from app.config import settings

RELEASE_SCOPE = frozenset(json.loads((Path(__file__).parents[1] / "production_tools.json").read_text()))


def parse_allowlist(value):
    if not isinstance(value, str) or len(value) > 256:
        raise ValueError("Invalid production converter allowlist")
    if not value:
        return frozenset()
    tools = value.split(",")
    if len(tools) != len(set(tools)) or any(
        tool not in RELEASE_SCOPE or not CAPABILITIES.get(tool) or not CAPABILITIES[tool].enabled
        for tool in tools
    ):
        raise ValueError("Invalid production converter allowlist")
    return frozenset(tools)


def conversion_error(tool, context):
    capability = CAPABILITIES.get(tool)
    if tool == "__fixture__":
        return None if context.environment == "test" and context.fixture else "UNSUPPORTED_FORMAT"
    if capability is None or not (
        capability.enabled or (context.environment == "test" and context.native_test)
    ):
        return "UNSUPPORTED_FORMAT"
    if context.environment == "production":
        if not context.production_conversions:
            return "SERVICE_UNAVAILABLE"
        try:
            allowed = parse_allowlist(context.production_tool_allowlist)
        except ValueError:
            return "SERVICE_UNAVAILABLE"
        if tool not in allowed:
            return "UNSUPPORTED_FORMAT"
    elif context.environment not in {"development", "test"}:
        return "SERVICE_UNAVAILABLE"
    return None


def runner_context():
    # Controller also supports standalone native qualification outside production.
    return replace(
        settings,
        environment=os.getenv("APP_ENV", settings.environment),
        production_conversions=os.getenv("PRODUCTION_CONVERSIONS_ENABLED", "false") == "true",
        production_tool_allowlist=os.getenv("PRODUCTION_TOOL_ALLOWLIST", ""),
    )

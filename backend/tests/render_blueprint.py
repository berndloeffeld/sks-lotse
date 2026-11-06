"""render.yaml, read per service, the way Render reads it (ADR-0005).

A check of one service reads that service's block, never the whole file.
"""

from pathlib import Path
from typing import Any

import yaml

RENDER_YAML = Path(__file__).resolve().parents[2] / "render.yaml"


def service(name: str) -> dict[str, Any]:
    services = yaml.safe_load(RENDER_YAML.read_text(encoding="utf-8"))["services"]
    matches = [s for s in services if s["name"] == name]
    assert len(matches) == 1, f"render.yaml has {len(matches)} services named {name}"
    return matches[0]


def env(name: str) -> dict[str, Any]:
    """The service's envVars as key → the var's entry (value, or sync: false)."""
    return {var["key"]: var for var in service(name).get("envVars", [])}


def rewrites(name: str) -> list[tuple[str, str]]:
    routes = service(name).get("routes", [])
    return [(r["source"], r["destination"]) for r in routes if r["type"] == "rewrite"]

"""render.yaml, read per service, the way Render reads it (ADR-0005, ADR-0067).

Two static sites build from frontend/ (sks-lotse-frontend and sbf-lotse-frontend), each with its own
env and rewrites, so a check of one site reads that site's block, never the whole file.
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


def header(name: str, header_name: str) -> str:
    values = [h["value"] for h in service(name).get("headers", []) if h["name"] == header_name]
    assert len(values) == 1, f"{name} sets {header_name} {len(values)} times"
    return values[0]


def csp_sources(name: str, directive: str) -> list[str]:
    """The sources one directive of the service's Content-Security-Policy allows, e.g. connect-src."""
    for part in header(name, "Content-Security-Policy").split(";"):
        tokens = part.split()
        if tokens and tokens[0] == directive:
            return tokens[1:]
    raise AssertionError(f"{name}'s CSP has no {directive}")

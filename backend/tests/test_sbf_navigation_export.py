import json

from app.services.sbf_navigation import EXPORT_PATH, catalog, render_export
from tests import render_blueprint

SBF = "sbf-lotse-frontend"


def test_the_committed_export_matches_the_yaml():
    # The SBF build's guest runs read this file (ADR-0068); a YAML change without a re-export would show
    # outdated tasks.
    assert EXPORT_PATH.read_text(encoding="utf-8") == render_export(catalog()), (
        "frontend/src/data/sbf_navigation.gen.json is stale: run "
        "`PYTHONPATH=. .venv/bin/python scripts/export_sbf_navigation.py` in backend/ and commit the result."
    )


def test_render_yaml_rewrites_the_navigation_pages_only_while_they_are_built():
    # /navigation and /navigation/<n> are prerendered only at VITE_SBF=on (ADR-0068); a rewrite to a file
    # the build doesn't write answers 200 with an empty body (ADR-0057).
    flag = render_blueprint.env(SBF)["VITE_SBF"]["value"]
    pages = {source for source, _ in render_blueprint.rewrites(SBF) if source.startswith("/navigation")}
    tasks = json.loads(EXPORT_PATH.read_text(encoding="utf-8"))["tasks"]

    expected = {"/navigation"} | {f"/navigation/{task['number']}" for task in tasks}
    assert pages == (expected if flag == "on" else set())

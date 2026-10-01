import yaml

from app.schemas.chart_exercise import ChartExerciseCatalog
from app.services.chart_exercises import EXPORT_PATH, catalog, render_export


def test_the_committed_export_matches_the_yaml():
    # The frontend's guest runs through the Kartenaufgaben and their prerender read this file
    # (ADR-0056); a YAML change without a re-export would show guests outdated tasks or solutions.
    assert EXPORT_PATH.read_text(encoding="utf-8") == render_export(catalog()), (
        "frontend/src/data/chart_exercises.gen.json is stale: run "
        "`PYTHONPATH=. .venv/bin/python scripts/export_chart_exercises.py` in backend/ and commit the result."
    )


def test_renders_stable_readable_json():
    text = render_export(catalog())
    assert text.endswith("\n")
    assert "Übungskarte" in text
    assert text == render_export(catalog())


def test_renders_exactly_this_text():
    data = ChartExerciseCatalog.model_validate(
        {
            "source": "WSV",
            "hints": ["Übung"],
            "tide_form": {"src": "f.png", "width": 1, "height": 2},
            "sheets": [],
        }
    )
    assert render_export(data) == (
        '{\n "source": "WSV",\n "hints": [\n  "Übung"\n ],\n'
        ' "tide_form": {\n  "src": "f.png",\n  "width": 1,\n  "height": 2\n },\n "sheets": []\n}\n'
    )


def test_render_yaml_sets_the_same_flag_for_api_and_build():
    # The API decides for learners, the build for guests (ADR-0056); apart, guests could get pages
    # whose feature the API still hides from logged-in learners, or the other way round. Read as
    # YAML, the way Render reads it: an unquoted `on` would be the boolean true, which the API's
    # setting rejects at startup.
    render_yaml = yaml.safe_load((EXPORT_PATH.parents[3] / "render.yaml").read_text(encoding="utf-8"))
    env = [var for service in render_yaml["services"] for var in service.get("envVars", [])]
    api = [var.get("value") for var in env if var["key"] == "CHART_EXERCISES"]
    build = [var.get("value") for var in env if var["key"] == "VITE_CHART_EXERCISES"]

    assert len(api) == 1
    assert api[0] in ("off", "admins", "on")
    assert build == api

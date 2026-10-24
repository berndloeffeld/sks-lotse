"""The SBF See Navigationsaufgaben (ADR-0068): the committed tasks, run in the SBF site's pages.

Read from app/data/sbf_navigation.yaml (proposed by scripts/extract_sbf_navigation.py, reviewed task
by task) and exported by scripts/export_sbf_navigation.py into the frontend, which runs them in the
page. The API never serves them; a run with an account stores only the learner's own answers and
points (app/services/sbf_navigation_runs.py, ADR-0071).
"""

import json
from functools import cache
from pathlib import Path

import yaml

from app.schemas.sbf_navigation import SbfNavigationCatalog, SbfNavigationTask

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "sbf_navigation.yaml"
# The committed copy the SBF build reads (ADR-0068).
EXPORT_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "sbf" / "data" / "sbf_navigation.gen.json"
)


@cache
def catalog() -> SbfNavigationCatalog:
    return SbfNavigationCatalog.model_validate(yaml.safe_load(DATA_PATH.read_text(encoding="utf-8")))


def render_export(data: SbfNavigationCatalog) -> str:
    """The export file's exact text: stable, so a stale file shows up as a diff."""
    return json.dumps(data.model_dump(mode="json"), ensure_ascii=False, indent=1) + "\n"


def max_points(task: SbfNavigationTask) -> int:
    """One point per subtask (SpFV Anlage 3 Nr. 1.1)."""
    return len(task.subtasks)


def task(number: int) -> SbfNavigationTask | None:
    return next((item for item in catalog().tasks if item.number == number), None)

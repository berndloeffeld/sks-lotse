"""Write the Kartenaufgaben export the frontend reads without a login (ADR-0056).

Usage:
    PYTHONPATH=. .venv/bin/python scripts/export_chart_exercises.py

Copies the committed app/data/chart_exercises.yaml, solutions included, to
frontend/src/data/chart_exercises.gen.json. Re-run it after the YAML changes;
tests/test_chart_exercises_export.py fails while the committed file is stale.
"""

from app.services.chart_exercises import EXPORT_PATH, catalog, render_export

if __name__ == "__main__":
    EXPORT_PATH.write_text(render_export(catalog()), encoding="utf-8")
    print(f"wrote {EXPORT_PATH}")

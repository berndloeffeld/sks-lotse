"""Export the SBF Navigationsaufgaben for the SBF build (ADR-0068).

    PYTHONPATH=. .venv/bin/python scripts/export_sbf_navigation.py

Writes frontend/src/sbf/data/sbf_navigation.gen.json from app/data/sbf_navigation.yaml; commit both.
tests/test_sbf_navigation_export.py fails while the export is stale.
"""

from app.services.sbf_navigation import EXPORT_PATH, catalog, render_export


def main() -> None:
    EXPORT_PATH.write_text(render_export(catalog()), encoding="utf-8")
    print(f"wrote {EXPORT_PATH}")


if __name__ == "__main__":
    main()

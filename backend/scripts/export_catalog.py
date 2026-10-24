"""Write the catalog export the frontend reads without a login (ADR-0054).

Usage:
    PYTHONPATH=. .venv/bin/python scripts/export_catalog.py

Builds the catalog from the committed sources (the PDF and the reviewed YAML files, no database)
and writes frontend/src/data/catalog.gen.json, plus the landing page's few sample questions to
frontend/src/data/landing_samples.gen.json. Re-run it after anything the catalog data
migrations sync changes; tests/test_catalog_export.py fails while the committed file is stale.
"""

from app.services.catalog_seed import (
    EXPORT_PATH,
    LANDING_SAMPLES_PATH,
    build_catalog,
    catalog_export,
    landing_samples_export,
    load_topics,
    render_catalog_export,
)

if __name__ == "__main__":
    export = catalog_export(build_catalog(), load_topics())
    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_PATH.write_text(render_catalog_export(export))
    print(f"wrote {EXPORT_PATH}")
    LANDING_SAMPLES_PATH.write_text(render_catalog_export(landing_samples_export(export)))
    print(f"wrote {LANDING_SAMPLES_PATH}")

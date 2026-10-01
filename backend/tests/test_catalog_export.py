import json
import re
from pathlib import Path

from app.services.catalog_seed import (
    EXPORT_PATH,
    CatalogImage,
    CatalogQuestion,
    build_catalog,
    catalog_export,
    load_topics,
    render_catalog_export,
)

TOPICS = {
    "wetterkunde": [
        {"slug": "wolken", "name": "Wolken", "display_order": 2},
        {"slug": "wind", "name": "Wind", "display_order": 1},
        {"slug": "leer", "name": "Ohne Fragen", "display_order": 3},
    ],
    "navigation": [{"slug": "seekarten", "name": "Seekarten", "display_order": 1}],
}


def test_the_committed_export_matches_the_catalog():
    # The frontend's logged-out learning and its prerender read this file (ADR-0054); a catalog
    # change without a re-export would show learners without a login an outdated catalog.
    expected = render_catalog_export(catalog_export(build_catalog(), load_topics()))
    assert EXPORT_PATH.read_text() == expected, (
        "frontend/src/data/catalog.gen.json is stale: run "
        "`PYTHONPATH=. .venv/bin/python scripts/export_catalog.py` in backend/ and commit the result."
    )


def test_orders_like_the_api_and_keeps_only_placed_content():
    image = CatalogImage(src="bild.png", width=10, height=20)
    questions = [
        CatalogQuestion("wetterkunde", 5, "F5", "A5", topic_slug="wolken"),
        CatalogQuestion("wetterkunde", 9, "F9", "A9", topic_slug="wind", answer_images=(image,)),
        CatalogQuestion("wetterkunde", 2, "F2", "A2", topic_slug="wind"),
        CatalogQuestion("navigation", 1, "N1", "", topic_slug="seekarten", question_images=(image,)),
        CatalogQuestion("navigation", 3, "N3", "A3", topic_slug=None),
        CatalogQuestion("navigation", 4, "N4", "A4", topic_slug="unbekannt"),
    ]

    export = catalog_export(questions, TOPICS)

    assert [(q["subject"], q["number"]) for q in export["questions"]] == [
        ("navigation", 1),
        ("wetterkunde", 2),
        ("wetterkunde", 9),
        ("wetterkunde", 5),
    ]
    assert export["topics"] == [
        {"subject": "navigation", "slug": "seekarten", "name": "Seekarten", "display_order": 1},
        {"subject": "wetterkunde", "slug": "wind", "name": "Wind", "display_order": 1},
        {"subject": "wetterkunde", "slug": "wolken", "name": "Wolken", "display_order": 2},
    ]
    assert export["questions"][0] == {
        "subject": "navigation",
        "number": 1,
        "topic": "seekarten",
        "question_text": "N1",
        "answer_text": "",
        "question_images": [{"src": "bild.png", "width": 10, "height": 20}],
        "answer_images": [],
    }
    assert export["questions"][2]["answer_images"] == [{"src": "bild.png", "width": 10, "height": 20}]


def test_renders_stable_readable_json():
    text = render_catalog_export({"topics": [], "questions": [{"question_text": "Übung"}]})
    assert text.endswith("\n")
    assert "Übung" in text
    assert text == render_catalog_export({"topics": [], "questions": [{"question_text": "Übung"}]})


def test_render_yaml_rewrites_every_open_learn_page():
    # The frontend prerenders /learn and one page per topic of the export (learnPages in
    # frontend/src/publicPages.ts); without its rewrite, Render would serve such a path the empty
    # app shell, and search engines would see nothing (ADR-0054).
    render_yaml = (Path(EXPORT_PATH).parents[3] / "render.yaml").read_text()
    rewrites = dict(re.findall(r"- type: rewrite\s+source: (\S+)\s+destination: (\S+)", render_yaml))
    topics = json.loads(EXPORT_PATH.read_text())["topics"]
    expected = {"/learn"} | {f"/learn/{t['subject']}/{t['slug']}" for t in topics}

    assert {source for source in rewrites if source.startswith("/learn")} == expected
    assert all(rewrites[path] == f"{path}.html" for path in expected)

import json

import pytest

from app.services.catalog_seed import (
    EXPORT_PATH,
    LANDING_SAMPLES_PATH,
    CatalogImage,
    CatalogQuestion,
    build_catalog,
    catalog_export,
    landing_samples_export,
    load_topics,
    render_catalog_export,
)
from tests import render_blueprint

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
        "frontend/src/sks/data/catalog.gen.json is stale: run "
        "`PYTHONPATH=. .venv/bin/python scripts/export_catalog.py` in backend/ and commit the result."
    )


def test_the_committed_landing_samples_match_the_catalog():
    # The landing page's hero shows these word for word; they come from the same export.
    expected = render_catalog_export(landing_samples_export(catalog_export(build_catalog(), load_topics())))
    assert LANDING_SAMPLES_PATH.read_text() == expected, (
        "frontend/src/sks/data/landing_samples.gen.json is stale: run "
        "`PYTHONPATH=. .venv/bin/python scripts/export_catalog.py` in backend/ and commit the result."
    )


def _sample_export(**extra) -> dict:
    question = {
        "subject": "wetterkunde",
        "number": 1,
        "topic": "wind",
        "question_text": "F1",
        "answer_text": "A1",
        "question_images": [],
        "answer_images": [],
        "derivation": [],
    }
    return {
        "topics": [{"subject": "wetterkunde", "slug": "wind", "name": "Wind", "display_order": 1}],
        "questions": [{**question, **extra}],
    }


def test_landing_samples_copy_the_question_with_its_topic_name():
    assert landing_samples_export(_sample_export(), [("wetterkunde", 1)]) == {
        "questions": [
            {
                "subject": "wetterkunde",
                "number": 1,
                "topic": "wind",
                "topic_name": "Wind",
                "question_text": "F1",
                "answer_text": "A1",
            }
        ]
    }


@pytest.mark.parametrize(
    ("extra", "samples", "message"),
    [
        ({}, [("wetterkunde", 2)], "is not in the catalog export"),
        ({"question_images": [{"src": "a.png"}]}, [("wetterkunde", 1)], "has images or a derivation"),
        ({"answer_images": [{"src": "a.png"}]}, [("wetterkunde", 1)], "has images or a derivation"),
        ({"derivation": [{"text": "x"}]}, [("wetterkunde", 1)], "has images or a derivation"),
    ],
)
def test_landing_samples_refuse_what_the_hero_cant_show(extra, samples, message):
    with pytest.raises(ValueError, match=message):
        landing_samples_export(_sample_export(**extra), samples)


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
        "derivation": [],
    }
    assert export["questions"][2]["answer_images"] == [{"src": "bild.png", "width": 10, "height": 20}]


def test_renders_stable_readable_json():
    text = render_catalog_export({"topics": [], "questions": [{"question_text": "Übung"}]})
    assert text.endswith("\n")
    assert "Übung" in text
    assert text == render_catalog_export({"topics": [], "questions": [{"question_text": "Übung"}]})


# The static prerendered pages besides "/" (STATIC_PAGES in frontend/src/sks/publicPages.ts).
STATIC_PAGES = {"/faq", "/imprint", "/privacy", "/terms", "/exam-process", "/learning-method", "/pricing"}


def test_render_yaml_rewrites_every_prerendered_page_to_its_file():
    # Render doesn't map /faq to faq.html, and a directory index (faq/index.html) answers /faq
    # with an empty 200 (ADR-0057). So every prerendered page needs its own rewrite, ahead of the
    # SPA fallback. The open /learn pages come from the export (learnPages, ADR-0054).
    rewrites = render_blueprint.rewrites("sks-lotse-frontend")
    topics = json.loads(EXPORT_PATH.read_text())["topics"]
    learn = {"/learn"} | {f"/learn/{t['subject']}/{t['slug']}" for t in topics}

    assert rewrites[-1] == ("/*", "/app.html")
    pages = dict(rewrites[:-1])
    assert all(destination == f"{source}.html" for source, destination in pages.items())
    assert {source for source in pages if not source.startswith("/charts")} == STATIC_PAGES | learn


def test_render_yaml_rewrites_the_chart_pages_only_while_they_are_built():
    # /charts and /charts/<n> are prerendered only at VITE_CHART_EXERCISES=on (ADR-0056); a rewrite
    # to a file the build doesn't write answers 200 with an empty body.
    flag = render_blueprint.env("sks-lotse-frontend")["VITE_CHART_EXERCISES"]["value"]
    rewrites = render_blueprint.rewrites("sks-lotse-frontend")
    charts = {source for source, _ in rewrites if source.startswith("/charts")}
    sheets = json.loads((EXPORT_PATH.parent / "chart_exercises.gen.json").read_text())["sheets"]

    expected = {"/charts"} | {f"/charts/{sheet['number']}" for sheet in sheets}
    assert charts == (expected if flag == "on" else set())

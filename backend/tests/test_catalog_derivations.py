from pathlib import Path

import pytest

from app.models.question import Question
from app.schemas.derivation import CatalogDerivation, DerivationBlock
from app.services import catalog_derivations
from app.services.catalog_derivations import derivation_for, derivations, fingerprint, load
from app.services.catalog_seed import build_catalog

DERIVATIONS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "derivations"


def test_every_derivation_belongs_to_a_catalog_question_and_its_current_answer():
    # A derivation is SKS Lotse's own text (ADR-0065): it must lead to the official answer as it
    # stands. A new catalog edition that changes an answer fails here until the derivation is checked.
    answers = {(q.subject, q.number): q.answer_text for q in build_catalog()}
    for key, entry in derivations().items():
        assert key in answers, f"{key} is not a catalog question"
        assert entry.answer_fingerprint == fingerprint(answers[key]), (
            f"the official answer of {key} changed: check its derivation in catalog_derivations.yaml, "
            f"then set its answer_fingerprint to {fingerprint(answers[key])}"
        )


def test_every_sketch_of_a_derivation_exists():
    for key, entry in derivations().items():
        for block in entry.blocks:
            if block.image:
                assert (DERIVATIONS_DIR / block.image.src).is_file(), f"{key}: {block.image.src} is missing"


def test_load_rejects_a_sketch_without_alt_text():
    image = "{src: a.svg, width: 1, height: 1, alt: ''}"
    entry = f"- {{subject: wetterkunde, number: 21, answer_fingerprint: abc, blocks: [{{image: {image}}}]}}\n"
    with pytest.raises(ValueError):
        load(entry)


def test_fingerprint_ignores_surrounding_whitespace_but_not_the_wording():
    assert fingerprint(" Rückgedreht. \n") == fingerprint("Rückgedreht.")
    assert fingerprint("Rückgedreht.") != fingerprint("Rechtsgedreht.")
    assert len(fingerprint("x")) == 12


def test_load_rejects_a_question_listed_twice():
    entry = "- {subject: wetterkunde, number: 25, answer_fingerprint: abc, blocks: [{text: x}]}\n"
    with pytest.raises(ValueError, match="twice"):
        load(entry * 2)


def test_load_requires_at_least_one_block():
    with pytest.raises(ValueError):
        load("- {subject: wetterkunde, number: 25, answer_fingerprint: abc, blocks: []}\n")


def test_load_of_an_empty_file_is_empty():
    assert load("") == {}


def test_derivation_for_a_question_without_one_is_empty():
    assert derivation_for("wetterkunde", 99_999) == []
    assert derivation_for("wetterkunde", 25)[0].text


def test_questions_api_carries_the_derivation(client, db_session, auth_headers, monkeypatch):
    text = "Die **Reibung am Boden** bremst den Wind."
    blocks = [DerivationBlock(text=text)]
    monkeypatch.setattr(
        catalog_derivations, "derivations", lambda: {("wetterkunde", 25): _entry("wetterkunde", 25, blocks)}
    )
    db_session.add_all(
        [
            Question(subject="wetterkunde", number=25, question_text="Warum?", answer_text="Rückgedreht."),
            Question(subject="wetterkunde", number=26, question_text="Wie?", answer_text="So."),
        ]
    )
    db_session.commit()

    body = client.get("/api/v1/questions", headers=auth_headers).json()

    by_number = {q["number"]: q for q in body}
    assert by_number[25]["derivation"] == [{"text": text, "table": None, "image": None}]
    assert by_number[26]["derivation"] == []


def _entry(subject, number, blocks):
    return CatalogDerivation(subject=subject, number=number, answer_fingerprint="-", blocks=blocks)

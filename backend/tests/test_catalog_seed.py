import dataclasses
import functools

import pytest
import yaml
from sqlalchemy import create_engine, text

from app.models import QuestionProgress, User
from app.models.question import Question
from app.models.topic import Topic
from app.services import catalog_seed
from app.services.catalog_seed import (
    ANSWER_START,
    CatalogImage,
    CatalogQuestion,
    assign_topics,
    attach_images,
    build_catalog,
    merge_seemannschaft,
    parse_catalog_pdf,
    seed_catalog,
    split_question_answer,
    sync_catalog,
    wording_differs,
)
from tests.helpers import progress_state

# The official answer to these is only a sketch in the PDF — no text at all.
SKETCH_ONLY_ANSWERS = {("seemannschaft_1", 79), ("seemannschaft_1", 104), ("seemannschaft_2", 65)}


def test_parse_catalog_pdf_matches_known_counts():
    questions = parse_catalog_pdf()
    assert len(questions) == 638

    counts: dict[str, int] = {}
    for q in questions:
        counts[q.subject] = counts.get(q.subject, 0) + 1
    assert counts == {
        "navigation": 118,
        "schifffahrtsrecht": 110,
        "wetterkunde": 101,
        "seemannschaft_1": 163,
        "seemannschaft_2": 146,
    }


def test_every_parsed_question_has_an_answer_apart_from_the_sketches():
    questions = list(_parsed_catalog().values())

    without_answer = {(q.subject, q.number) for q in questions if not q.answer_text}
    assert without_answer == SKETCH_ONLY_ANSWERS
    assert all(q.question_text for q in questions)
    assert not any(ANSWER_START in q.question_text + q.answer_text for q in questions)


@functools.cache
def _parsed_catalog():
    return {(q.subject, q.number): q for q in parse_catalog_pdf()}


def _parsed(subject: str, number: int):
    return _parsed_catalog()[(subject, number)]


def test_parse_splits_numbered_sub_questions_from_numbered_answer():
    # Regression: a question ending in numbered sub-questions, followed by a
    # numbered answer, used to land entirely in question_text.
    q = _parsed("seemannschaft_1", 143)
    assert q.question_text == (
        "Welcher Ankergrund ist für die üblichen Leichtgewichtsanker\n"
        "1. gut geeignet?\n2. mäßig geeignet?\n3. ungeeignet?"
    )
    assert q.answer_text.startswith("1. Sand, Schlick, weicher Ton und Lehm,")


def test_parse_splits_question_with_abbreviation_before_the_question_mark():
    # Regression: the "." in "z. B." made the old punctuation heuristic give up.
    q = _parsed("seemannschaft_1", 159)
    assert q.question_text.endswith("kurvenreichen Fahrwasser, beachten?")
    assert q.answer_text.startswith("Bei einer Kursänderung schwenkt das Heck")


def test_parse_keeps_a_trailing_instruction_in_the_question():
    # "Nennen Sie ..." is part of the (bold) question, not of the answer.
    q = _parsed("seemannschaft_1", 124)
    assert q.question_text.endswith("zu beachten? Nennen Sie mindestens 6 Beispiele.")
    assert q.answer_text.startswith("1. Seetüchtigkeit der Yacht,")


def test_parse_ignores_a_bold_word_inside_an_answer():
    q = _parsed("navigation", 70)
    assert q.question_text.endswith("unberücksichtigt bleiben)?")
    assert "in einer Ebene mit der Erde" in q.answer_text


def test_parse_restores_the_drying_height_symbol_in_navigation_84():
    question = _parsed("navigation", 84).question_text
    assert "Tiefenangabe 2\u0332\u2083." in question
    assert "2 3" not in question


def test_parse_restores_the_subscripts_in_the_navigation_48_answer():
    answer = _parsed("navigation", 48).answer_text
    assert "Koppelort (O_k) zum beobachteten Ort (O_b)" in answer
    assert not answer.endswith(" k b")


def test_parse_joins_lines_the_pdf_only_wrapped():
    assert "nur ein Hoch- bzw. Niedrigwasser pro Tag?" in _parsed("navigation", 72).question_text
    assert _parsed("navigation", 84).question_text.endswith("2\u0332\u2083. Was bedeutet das?")
    assert (
        _parsed("navigation", 26).question_text
        == 'Was ist die "Sichtweite" eines Feuers? Wovon hängt sie ab?'
    )


def test_parse_keeps_line_breaks_before_list_items():
    question = _parsed("navigation", 20).question_text
    assert question.startswith("1. Was sind Richtfeuer (leading lights)?\n2. Wann befindet man sich")


def test_unwrap_soft_breaks():
    assert catalog_seed.unwrap_soft_breaks("Nord-\nund Ostsee") == "Nord- und Ostsee"
    assert catalog_seed.unwrap_soft_breaks("Frage:\n1. a\n2. b") == "Frage:\n1. a\n2. b"


def test_split_question_answer_splits_at_the_first_marker_only():
    body = f"Frage? \n{ANSWER_START}Antwort mit {ANSWER_START}fettem Wort. \n"
    assert split_question_answer(body) == ("Frage?", "Antwort mit fettem Wort.")
    assert split_question_answer("Nur eine Frage? \n") == ("Nur eine Frage?", "")


def test_merge_seemannschaft_collapses_into_three_subjects():
    merged = merge_seemannschaft(parse_catalog_pdf())

    counts: dict[str, int] = {}
    for q in merged:
        counts[q.subject] = counts.get(q.subject, 0) + 1
    assert counts["seemannschaft_allgemein"] == 98
    assert counts["seemannschaft_segeln"] == 65
    assert counts["seemannschaft_motor"] == 48
    assert "seemannschaft_1" not in counts
    assert "seemannschaft_2" not in counts

    # A merged row keeps both original catalog numbers.
    allgemein_sample = next(q for q in merged if q.subject == "seemannschaft_allgemein" and q.number == 1)
    assert allgemein_sample.seemannschaft_1_number is not None
    assert allgemein_sample.seemannschaft_2_number is not None

    # A variant-exclusive row keeps only its own original number.
    segeln_sample = next(q for q in merged if q.subject == "seemannschaft_segeln")
    assert segeln_sample.seemannschaft_1_number == segeln_sample.number
    assert segeln_sample.seemannschaft_2_number is None


@pytest.mark.parametrize(
    "pair", ["{seemannschaft_1: 1, seemannschaft_2: 9999}", "{seemannschaft_1: 9999, seemannschaft_2: 1}"]
)
def test_merge_seemannschaft_rejects_pair_with_unknown_question(tmp_path, monkeypatch, pair):
    duplicates = tmp_path / "duplicates.yaml"
    duplicates.write_text(f"- {pair}\n")
    monkeypatch.setattr(catalog_seed, "SEEMANNSCHAFT_DUPLICATES_PATH", duplicates)

    with pytest.raises(ValueError, match="9999"):
        merge_seemannschaft(parse_catalog_pdf())


def test_merge_seemannschaft_rejects_differing_pair_without_accepted_difference(tmp_path, monkeypatch):
    # S I #55 / S II #45: 3 vs. 5 fueling measures — deliberately not merged.
    duplicates = tmp_path / "duplicates.yaml"
    duplicates.write_text(
        "- {seemannschaft_1: 1, seemannschaft_2: 5}\n"
        "- {seemannschaft_1: 55, seemannschaft_2: 45}\n"
        "- {seemannschaft_1: 5, seemannschaft_2: 9, accepted_difference: S II typos}\n"
    )
    monkeypatch.setattr(catalog_seed, "SEEMANNSCHAFT_DUPLICATES_PATH", duplicates)

    with pytest.raises(ValueError, match=r"accepted_difference: 55/45$"):
        merge_seemannschaft(parse_catalog_pdf())


def test_reviewed_pairs_are_identical_or_carry_an_accepted_difference():
    # Stale rationales too: an accepted_difference on a pair that no longer
    # differs (e.g. after a parser fix) should be removed, not kept around.
    raw = parse_catalog_pdf()
    s1 = {q.number: q for q in raw if q.subject == "seemannschaft_1"}
    s2 = {q.number: q for q in raw if q.subject == "seemannschaft_2"}
    pairs = yaml.safe_load(catalog_seed.SEEMANNSCHAFT_DUPLICATES_PATH.read_text())

    for pair in pairs:
        differs = wording_differs(s1[pair["seemannschaft_1"]], s2[pair["seemannschaft_2"]])
        assert differs == bool(pair.get("accepted_difference")), pair


def test_assign_topics_ignores_missing_files_and_unknown_slugs(tmp_path, monkeypatch):
    (tmp_path / "navigation.yaml").write_text("1: not-a-real-slug\n")
    monkeypatch.setattr(catalog_seed, "ASSIGNMENTS_DIR", tmp_path)

    questions = assign_topics(merge_seemannschaft(parse_catalog_pdf()))
    assert all(q.topic_slug is None for q in questions)


def test_seed_catalog_end_to_end(db_session):
    unassigned = seed_catalog(db_session)

    assert unassigned == []
    assert db_session.query(Question).count() == 540
    assert db_session.query(Topic).count() == 25
    assert db_session.query(Question).filter(Question.topic_id.is_(None)).count() == 0
    subjects = {s for (s,) in db_session.query(Question.subject).distinct().all()}
    assert subjects == {
        "navigation",
        "schifffahrtsrecht",
        "wetterkunde",
        "seemannschaft_allgemein",
        "seemannschaft_motor",
        "seemannschaft_segeln",
    }


def test_reseed_keeps_question_ids_and_learner_progress(db_session):
    seed_catalog(db_session)
    ids_before = {(q.subject, q.number): q.id for q in db_session.query(Question)}

    user = User(email="learner@example.com")
    db_session.add(user)
    db_session.flush()
    question = db_session.query(Question).filter_by(subject="navigation", number=1).one()
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, **progress_state(2)))
    db_session.commit()

    seed_catalog(db_session)

    ids_after = {(q.subject, q.number): q.id for q in db_session.query(Question)}
    assert ids_after == ids_before
    assert db_session.query(Topic).count() == 25
    progress = db_session.query(QuestionProgress).one()
    assert progress.question_id == question.id
    assert progress.half_life_days == pytest.approx(6.25)


def test_sync_updates_changed_rows_and_removes_vanished_ones(db_session):
    catalog = build_catalog()
    sync_catalog(db_session.connection(), catalog)

    first = catalog[0]
    edited = dataclasses.replace(first, answer_text="Neue Musterantwort")
    remaining = [edited, *catalog[2:]]
    sync_catalog(db_session.connection(), remaining)
    db_session.commit()

    assert db_session.query(Question).count() == len(catalog) - 1
    row = db_session.query(Question).filter_by(subject=first.subject, number=first.number).one()
    assert row.answer_text == "Neue Musterantwort"
    removed = catalog[1]
    assert db_session.query(Question).filter_by(subject=removed.subject, number=removed.number).count() == 0


def test_sync_only_needs_the_columns_that_existed_when_the_seed_migration_ran():
    # The data migrations run sync_catalog against the schema of *their*
    # revision, not head's. Tables with exactly the columns as of revision
    # 16af6f481bf6 must be enough — a column the ORM models gained later
    # must never end up in its statements.
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE topics (id INTEGER PRIMARY KEY, subject VARCHAR NOT NULL,"
                " slug VARCHAR NOT NULL, name VARCHAR NOT NULL, display_order INTEGER NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE questions (id INTEGER PRIMARY KEY, subject VARCHAR NOT NULL,"
                " number INTEGER NOT NULL, question_text TEXT NOT NULL, answer_text TEXT NOT NULL,"
                " image_ref VARCHAR, topic_id INTEGER,"
                " seemannschaft_1_number INTEGER, seemannschaft_2_number INTEGER)"
            )
        )
        sync_catalog(connection, build_catalog())
        assert connection.execute(text("SELECT count(*) FROM questions")).scalar_one() == 540


def _seemannschaft_ids(db_session) -> dict[tuple[int | None, int | None], int]:
    rows = db_session.query(Question).filter(Question.subject.like("seemannschaft_%"))
    return {(q.seemannschaft_1_number, q.seemannschaft_2_number): q.id for q in rows}


def test_resync_after_unmerging_a_pair_keeps_progress_on_the_same_official_question(
    db_session, tmp_path, monkeypatch
):
    # The state before ADR-0026: S I #55 / S II #45 still merged, so every
    # later seemannschaft_allgemein row sat one number higher than now.
    reviewed = catalog_seed.SEEMANNSCHAFT_DUPLICATES_PATH.read_text()
    old_duplicates = tmp_path / "duplicates.yaml"
    old_duplicates.write_text(
        reviewed + "- {seemannschaft_1: 55, seemannschaft_2: 45, accepted_difference: test}\n"
    )
    monkeypatch.setattr(catalog_seed, "SEEMANNSCHAFT_DUPLICATES_PATH", old_duplicates)
    seed_catalog(db_session)
    before = _seemannschaft_ids(db_session)
    unmerged = db_session.get(Question, before[(55, 45)])
    shifted = db_session.get(Question, before[(57, 33)])  # the next pair after #55
    shifted_number = shifted.number

    user = User(email="learner@example.com")
    db_session.add(user)
    db_session.flush()
    db_session.add_all(
        [
            QuestionProgress(user_id=user.id, question_id=unmerged.id, **progress_state(2)),
            QuestionProgress(user_id=user.id, question_id=shifted.id, **progress_state(1)),
        ]
    )
    db_session.commit()

    monkeypatch.undo()
    seed_catalog(db_session)
    db_session.expire_all()

    after = _seemannschaft_ids(db_session)
    # Every pair that stays merged keeps its row; later ones only renumber.
    assert {k: v for k, v in after.items() if k != (55, None) and k != (None, 45)} == {
        k: v for k, v in before.items() if k != (55, 45)
    }
    assert db_session.get(Question, shifted.id).number == shifted_number - 1

    segeln = db_session.query(Question).filter_by(subject="seemannschaft_segeln", number=55).one()
    motor = db_session.query(Question).filter_by(subject="seemannschaft_motor", number=45).one()
    assert segeln.id == unmerged.id
    assert "Diesel" in segeln.question_text
    assert "Brennstoffen" in motor.question_text
    assert (segeln.seemannschaft_1_number, segeln.seemannschaft_2_number) == (55, None)
    assert (motor.seemannschaft_1_number, motor.seemannschaft_2_number) == (None, 45)
    assert motor.topic_id is not None

    half_lives = {p.question_id: p.half_life_days for p in db_session.query(QuestionProgress)}
    assert half_lives == {segeln.id: 6.25, motor.id: 6.25, shifted.id: 2.5}
    assert db_session.query(Question).count() == 540


def test_resync_after_merging_a_pair_keeps_the_segeln_row_and_drops_the_motor_row(db_session):
    def question(subject, number, s1=None, s2=None):
        return CatalogQuestion(subject, number, f"Frage {subject} {number}", "Antwort", s1, s2)

    sync_catalog(
        db_session.connection(),
        [question("seemannschaft_segeln", 12, s1=12), question("seemannschaft_motor", 30, s2=30)],
    )
    segeln_id = _seemannschaft_ids(db_session)[(12, None)]

    sync_catalog(
        db_session.connection(),
        [question("seemannschaft_allgemein", 1, s1=12, s2=30), question("seemannschaft_segeln", 13, s1=13)],
    )
    db_session.commit()

    after = _seemannschaft_ids(db_session)
    assert after[(12, 30)] == segeln_id
    assert set(after) == {(12, 30), (13, None)}


def _catalog_row(catalog, subject, number):
    return next(q for q in catalog if (q.subject, q.number) == (subject, number))


def test_catalog_images_are_attached_to_their_question_and_part():
    catalog = build_catalog()

    # Both light diagrams sit in the question, the answer has none.
    lights = _catalog_row(catalog, "schifffahrtsrecht", 23)
    assert [i.src for i in lights.question_images] == [
        "schifffahrtsrecht-23-1.png",
        "schifffahrtsrecht-23-2.png",
    ]
    assert lights.answer_images == ()

    # A sketch question: the empty sketch is the question's, the solved one the answer's. The
    # merged Seemannschaft row keeps the Seemannschaft I images (Seemannschaft I 78 = II 64).
    sketch = next(q for q in catalog if q.seemannschaft_1_number == 78 and q.seemannschaft_2_number == 64)
    assert [i.src for i in sketch.question_images] == ["seemannschaft_1-78-1.png"]
    assert [i.src for i in sketch.answer_images] == ["seemannschaft_1-78-2.png"]

    # The official answer that is *only* a sketch has no text, but an image.
    sketch_only = _catalog_row(catalog, "seemannschaft_segeln", 104)
    assert sketch_only.answer_text == ""
    assert len(sketch_only.answer_images) == 1

    assert _catalog_row(catalog, "navigation", 1).question_images == ()


def test_every_committed_catalog_image_is_listed_in_the_reviewed_file():
    listed = {entry["file"] for entry in yaml.safe_load(catalog_seed.IMAGES_PATH.read_text())}
    assert {p.name for p in catalog_seed.IMAGES_DIR.glob("*.png")} == listed


def _images_file(tmp_path, monkeypatch, entry: dict):
    path = tmp_path / "question_images.yaml"
    path.write_text(yaml.safe_dump([entry]))
    monkeypatch.setattr(catalog_seed, "IMAGES_PATH", path)


def _entry(**changes) -> dict:
    return {
        "subject": "navigation",
        "number": 1,
        "part": "answer",
        "file": "x.png",
        "width": 1,
        "height": 1,
    } | changes


@pytest.mark.parametrize(
    ("entry", "message"),
    [
        (_entry(number=9999), "no question navigation 9999"),
        (_entry(part="sideways"), "part 'sideways'"),
        (_entry(file="nope.png"), "nope.png is missing"),
    ],
)
def test_attach_images_rejects_a_bad_entry(tmp_path, monkeypatch, entry, message):
    _images_file(tmp_path, monkeypatch, entry)
    with pytest.raises(ValueError, match=message):
        attach_images(parse_catalog_pdf())


def test_seeding_stores_the_images_and_reseeding_updates_them(db_session, monkeypatch):
    seed_catalog(db_session)
    lights = db_session.query(Question).filter_by(subject="schifffahrtsrecht", number=23).one()
    assert lights.question_images == [
        {"src": "schifffahrtsrecht-23-1.png", "width": 64, "height": 49},
        {"src": "schifffahrtsrecht-23-2.png", "width": 129, "height": 64},
    ]
    assert lights.answer_images == []

    # An entry moving between the two parts is picked up by a plain re-sync.
    changed = [
        dataclasses.replace(q, question_images=(), answer_images=(CatalogImage("x.png", 1, 2),))
        if (q.subject, q.number) == ("schifffahrtsrecht", 23)
        else q
        for q in build_catalog()
    ]
    monkeypatch.setattr(catalog_seed, "build_catalog", lambda: changed)
    seed_catalog(db_session)
    db_session.expire_all()
    lights = db_session.query(Question).filter_by(subject="schifffahrtsrecht", number=23).one()
    assert lights.question_images == []
    assert lights.answer_images == [{"src": "x.png", "width": 1, "height": 2}]

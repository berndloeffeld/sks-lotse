import dataclasses
import functools

from sqlalchemy import create_engine, text

from app.models import QuestionProgress, User
from app.models.question import Question
from app.models.topic import Topic
from app.services import catalog_seed
from app.services.catalog_seed import (
    ANSWER_START,
    assign_topics,
    build_catalog,
    merge_seemannschaft,
    parse_catalog_pdf,
    seed_catalog,
    split_question_answer,
    sync_catalog,
)

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
        "Welcher Ankergrund ist für die üblichen Leichtgewichtsanker \n"
        "1. gut geeignet? \n2. mäßig geeignet? \n3. ungeeignet?"
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
    assert q.question_text.endswith("zu beachten? \nNennen Sie mindestens 6 Beispiele.")
    assert q.answer_text.startswith("1. Seetüchtigkeit der Yacht,")


def test_parse_ignores_a_bold_word_inside_an_answer():
    q = _parsed("navigation", 70)
    assert q.question_text.endswith("unberücksichtigt bleiben)?")
    assert "in einer Ebene mit der Erde" in q.answer_text


def test_split_question_answer_splits_at_the_first_marker_only():
    body = f"Frage? \n{ANSWER_START}Antwort mit {ANSWER_START}fettem Wort. \n"
    assert split_question_answer(body) == ("Frage?", "Antwort mit fettem Wort.")
    assert split_question_answer("Nur eine Frage? \n") == ("Nur eine Frage?", "")


def test_merge_seemannschaft_collapses_into_three_subjects():
    merged = merge_seemannschaft(parse_catalog_pdf())

    counts: dict[str, int] = {}
    for q in merged:
        counts[q.subject] = counts.get(q.subject, 0) + 1
    assert counts["seemannschaft_allgemein"] == 106
    assert counts["seemannschaft_segeln"] == 57
    assert counts["seemannschaft_motor"] == 40
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


def test_merge_seemannschaft_rejects_pair_with_unknown_question(tmp_path, monkeypatch):
    duplicates = tmp_path / "duplicates.yaml"
    duplicates.write_text("- {seemannschaft_1: 1, seemannschaft_2: 9999}\n")
    monkeypatch.setattr(catalog_seed, "SEEMANNSCHAFT_DUPLICATES_PATH", duplicates)

    try:
        merge_seemannschaft(parse_catalog_pdf())
    except ValueError as exc:
        assert "9999" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_assign_topics_ignores_missing_files_and_unknown_slugs(tmp_path, monkeypatch):
    (tmp_path / "navigation.yaml").write_text("1: not-a-real-slug\n")
    monkeypatch.setattr(catalog_seed, "ASSIGNMENTS_DIR", tmp_path)

    questions = assign_topics(merge_seemannschaft(parse_catalog_pdf()))
    assert all(q.topic_slug is None for q in questions)


def test_seed_catalog_end_to_end(db_session):
    unassigned = seed_catalog(db_session)

    assert unassigned == []
    assert db_session.query(Question).count() == 532
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
    db_session.add(QuestionProgress(user_id=user.id, question_id=question.id, correct_streak=2))
    db_session.commit()

    seed_catalog(db_session)

    ids_after = {(q.subject, q.number): q.id for q in db_session.query(Question)}
    assert ids_after == ids_before
    assert db_session.query(Topic).count() == 25
    progress = db_session.query(QuestionProgress).one()
    assert progress.question_id == question.id
    assert progress.correct_streak == 2


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
        assert connection.execute(text("SELECT count(*) FROM questions")).scalar_one() == 532

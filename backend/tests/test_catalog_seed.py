from app.models.question import Question
from app.models.topic import Topic
from app.services.catalog_seed import (
    apply_topics,
    import_catalog,
    merge_seemannschaft,
    parse_catalog_pdf,
    seed_catalog,
)


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


def test_import_catalog_populates_and_replaces(db_session):
    count = import_catalog(db_session)
    assert count == 638
    assert db_session.query(Question).count() == 638

    # Re-running replaces the table's contents rather than appending to it.
    count_again = import_catalog(db_session)
    assert count_again == 638
    assert db_session.query(Question).count() == 638


def test_merge_seemannschaft_collapses_into_three_subjects(db_session):
    import_catalog(db_session)
    counts = merge_seemannschaft(db_session)

    assert counts == {
        "seemannschaft_allgemein": 106,
        "seemannschaft_segeln": 57,
        "seemannschaft_motor": 40,
    }
    subjects = {s for (s,) in db_session.query(Question.subject).distinct().all()}
    assert "seemannschaft_1" not in subjects
    assert "seemannschaft_2" not in subjects

    # A merged row keeps both original catalog numbers.
    allgemein_sample = (
        db_session.query(Question)
        .filter(Question.subject == "seemannschaft_allgemein", Question.number == 1)
        .one()
    )
    assert allgemein_sample.seemannschaft_1_number is not None
    assert allgemein_sample.seemannschaft_2_number is not None

    # A variant-exclusive row keeps only its own original number.
    segeln_sample = db_session.query(Question).filter(Question.subject == "seemannschaft_segeln").first()
    assert segeln_sample.seemannschaft_1_number is not None
    assert segeln_sample.seemannschaft_2_number is None


def test_apply_topics_assigns_every_question_and_is_idempotent(db_session):
    import_catalog(db_session)
    merge_seemannschaft(db_session)

    unassigned = apply_topics(db_session)
    assert unassigned == []
    assert db_session.query(Topic).count() == 67
    assert db_session.query(Question).filter(Question.topic_id.is_(None)).count() == 0

    # Re-running updates existing Topic rows in place rather than duplicating them.
    unassigned_again = apply_topics(db_session)
    assert unassigned_again == []
    assert db_session.query(Topic).count() == 67


def test_seed_catalog_end_to_end(db_session):
    seed_catalog(db_session)

    assert db_session.query(Question).count() == 532
    assert db_session.query(Topic).count() == 67
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

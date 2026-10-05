from app.domain.exam_variant import EXAM_VARIANTS, restrict_to_variant, subjects_for_variant


def test_subjects_for_known_variant():
    assert subjects_for_variant("motor") == EXAM_VARIANTS["motor"]
    assert "seemannschaft_segeln" in subjects_for_variant("segeln_und_motor")


def test_no_filter_without_or_with_an_unknown_variant():
    assert subjects_for_variant(None) is None
    assert subjects_for_variant("rudern") is None


def test_restrict_to_variant_filters_a_statement_only_for_a_known_variant():
    from sqlalchemy import select

    from app.models.question import Question

    base = select(Question)

    assert restrict_to_variant(base, Question.subject, None) is base
    assert restrict_to_variant(base, Question.subject, "rudern") is base
    filtered = restrict_to_variant(base, Question.subject, "motor")
    assert filtered is not base
    assert "subject IN" in str(filtered)

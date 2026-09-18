from app.core.exam_variant import EXAM_VARIANTS, subjects_for_variant


def test_subjects_for_known_variant():
    assert subjects_for_variant("motor") == EXAM_VARIANTS["motor"]
    assert "seemannschaft_segeln" in subjects_for_variant("segeln_und_motor")


def test_no_filter_without_or_with_an_unknown_variant():
    assert subjects_for_variant(None) is None
    assert subjects_for_variant("rudern") is None

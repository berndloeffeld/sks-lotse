"""Which question subjects belong to each SKS exam variant.

The official catalog is split by propulsion type: "Motor" (engine only) and
"Segeln und Motor" (engine and sail). Both variants share Navigation,
Schifffahrtsrecht and Wetterkunde in full, plus the common Seemannschaft
questions (seemannschaft_allgemein); only the variant-specific Seemannschaft
questions (seemannschaft_motor / seemannschaft_segeln) differ. See
backend/scripts/merge_seemannschaft.py and docs/catalog-pipeline.md.
"""

from sqlalchemy import Select

EXAM_VARIANTS: dict[str, set[str]] = {
    "motor": {
        "navigation",
        "schifffahrtsrecht",
        "wetterkunde",
        "seemannschaft_allgemein",
        "seemannschaft_motor",
    },
    "segeln_und_motor": {
        "navigation",
        "schifffahrtsrecht",
        "wetterkunde",
        "seemannschaft_allgemein",
        "seemannschaft_segeln",
    },
}


def subjects_for_variant(exam_variant: str | None) -> set[str] | None:
    """The subjects a learner with this exam variant should see by default.

    None means "don't filter": no variant picked yet (User.exam_variant is
    NULL until the learner chooses one), or a value this module doesn't know.
    """
    if exam_variant is None:
        return None
    return EXAM_VARIANTS.get(exam_variant)


def restrict_to_variant[S: Select](stmt: S, subject_column, exam_variant: str | None) -> S:
    """`stmt` limited to the subjects of this exam variant; unchanged when there is nothing to filter by."""
    allowed = subjects_for_variant(exam_variant)
    return stmt if allowed is None else stmt.where(subject_column.in_(allowed))

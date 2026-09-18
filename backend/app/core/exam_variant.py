"""Which question subjects belong to each SKS exam variant.

The official catalog is split by propulsion type: "Motor" (engine only) and
"Segeln und Motor" (engine and sail). Both variants share Navigation,
Schifffahrtsrecht and Wetterkunde in full, plus the common Seemannschaft
questions (seemannschaft_allgemein); only the variant-specific Seemannschaft
questions (seemannschaft_motor / seemannschaft_segeln) differ. See
backend/scripts/merge_seemannschaft.py and CLAUDE.md → Question Catalog.
"""

from typing import Literal

ExamVariant = Literal["motor", "segeln_und_motor"]

EXAM_VARIANTS: dict[ExamVariant, set[str]] = {
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

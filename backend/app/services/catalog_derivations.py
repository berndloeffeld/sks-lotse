"""SKS Lotse's own derivations for catalog questions (ADR-0065): not official, never in the catalog tables.

Read from app/data/catalog_derivations.yaml, written or reviewed by hand, keyed by subject and number
— static data that only changes with a deploy, so it's loaded once per process. Each entry carries a
fingerprint of the official answer it was written against; tests/test_catalog_derivations.py fails
when that answer changes, so a new catalog edition can't leave a derivation silently out of date.
"""

import hashlib
from functools import cache
from pathlib import Path

import yaml

from app.schemas.derivation import CatalogDerivation, DerivationBlock

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "catalog_derivations.yaml"


def fingerprint(answer_text: str) -> str:
    """Short hash of an official answer; whitespace at the ends doesn't count."""
    return hashlib.sha256(answer_text.strip().encode("utf-8")).hexdigest()[:12]


def load(text: str) -> dict[tuple[str, int], CatalogDerivation]:
    entries = [CatalogDerivation.model_validate(raw) for raw in yaml.safe_load(text) or []]
    by_key = {(e.subject, e.number): e for e in entries}
    if len(by_key) != len(entries):
        raise ValueError("catalog_derivations.yaml lists a question twice")
    return by_key


@cache
def derivations() -> dict[tuple[str, int], CatalogDerivation]:
    return load(DATA_PATH.read_text(encoding="utf-8"))


def derivation_for(subject: str, number: int) -> list[DerivationBlock]:
    """The question's derivation, or an empty list when it has none."""
    entry = derivations().get((subject, number))
    return list(entry.blocks) if entry else []

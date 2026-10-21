"""A derivation: the working that leads to an answer, as paragraphs and tables.

Shared by the Kartenaufgaben, whose derivation is the WSV's own (ADR-0053), and the catalog questions,
whose derivation is SKS Lotse's and not official (ADR-0065).
"""

from pydantic import BaseModel, Field


class DerivationTableRow(BaseModel):
    cells: list[str]
    # Ruled off above, like a sum in the PDF's calculation tables — across the whole row, or only its
    # first `sum_until` cells when the line covers just one column (a value given, the other summed).
    sum: bool = False
    sum_until: int | None = None


class DerivationBlock(BaseModel):
    """A paragraph or a table of the working; **bold** marks an intermediate result."""

    text: str | None = None
    table: list[DerivationTableRow] | None = None


class CatalogDerivation(BaseModel):
    """One catalog question's derivation as committed in app/data/catalog_derivations.yaml (ADR-0065)."""

    subject: str
    number: int
    # Short hash of the official answer the derivation was written against (catalog_derivations.fingerprint).
    answer_fingerprint: str
    blocks: list[DerivationBlock] = Field(min_length=1)

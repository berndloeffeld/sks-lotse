"""Reserving/refunding tokens against a user's balance, and granting new ones (ADR-0043).

Mirrors `app/services/ai_quota.py`'s reserve/refund shape for the (still separate) weekly
budget — the two brakes are independent and a check must clear both (see
`app/api/v1/grading.py`).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.purchase import Purchase
from app.models.user import User

TOKENS_PER_ANSWER_CHECK = 1


def _locked_user(db: Session, user_id: int) -> User:
    # FOR UPDATE (a no-op on SQLite) serializes parallel spends/grants so two can't both spend the
    # last token; populate_existing because the caller's own copy of the row may already be stale.
    stmt = select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
    return db.execute(stmt).scalar_one()


def reserve(db: Session, user_id: int) -> int | None:
    """Spend one answer check's worth of tokens. Returns tokens left, or None if the balance is too low."""
    user = _locked_user(db, user_id)
    if user.token_balance < TOKENS_PER_ANSWER_CHECK:
        db.commit()
        return None
    user.token_balance -= TOKENS_PER_ANSWER_CHECK
    db.commit()
    return user.token_balance


def refund(db: Session, user_id: int) -> None:
    """Give back a reserved token (the LLM call failed) — a check that never happened costs nothing."""
    user = _locked_user(db, user_id)
    user.token_balance += TOKENS_PER_ANSWER_CHECK
    db.commit()


def grant(
    db: Session,
    user_id: int,
    *,
    product: str,
    tokens: int | None,
    amount_eur_cents: int | None,
    granted_by: str,
    admin_user_id: int | None = None,
) -> Purchase:
    """Credit tokens (if any) to the balance and record the grant in the purchases ledger.

    `tokens=None` records a grant with no token effect (e.g. the ads-removed fee). `amount_eur_cents`
    stays `None` for grants that involved no money — see `app/models/purchase.py` on why that
    distinction matters for account deletion.
    """
    user = _locked_user(db, user_id)
    if tokens:
        user.token_balance += tokens
    purchase = Purchase(
        user_id=user_id,
        product=product,
        tokens_granted=tokens,
        amount_eur_cents=amount_eur_cents,
        granted_by=granted_by,
        admin_user_id=admin_user_id,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase

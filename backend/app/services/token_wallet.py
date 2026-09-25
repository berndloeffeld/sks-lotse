"""Reserving/refunding tokens against a user's balance, and granting new ones (ADR-0043).

The token balance is the sole spending control for the AI answer check (ADR-0044 dropped the
separate weekly budget this used to sit alongside) — `app/api/v1/grading.py` reserves one token
per check and refunds it if the LLM call fails.
"""

from sqlalchemy.orm import Session

from app.models.purchase import Purchase
from app.services.user import locked_user

TOKENS_PER_ANSWER_CHECK = 1


def reserve(db: Session, user_id: int) -> int | None:
    """Spend one answer check's worth of tokens. Returns tokens left, or None if the balance is too low."""
    user = locked_user(db, user_id)
    if user.token_balance < TOKENS_PER_ANSWER_CHECK:
        db.commit()
        return None
    user.token_balance -= TOKENS_PER_ANSWER_CHECK
    db.commit()
    return user.token_balance


def refund(db: Session, user_id: int) -> None:
    """Give back a reserved token (the LLM call failed) — a check that never happened costs nothing."""
    user = locked_user(db, user_id)
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
    stripe_payment_intent_id: str | None = None,
) -> Purchase:
    """Credit tokens (if any) to the balance and record the grant in the purchases ledger.

    `tokens=None` records a grant with no token effect (e.g. the ads-removed fee). `amount_eur_cents`
    stays `None` for grants that involved no money — see `app/models/purchase.py` on why that
    distinction matters for account deletion.
    """
    user = locked_user(db, user_id)
    if tokens:
        user.token_balance += tokens
    purchase = Purchase(
        user_id=user_id,
        product=product,
        tokens_granted=tokens,
        amount_eur_cents=amount_eur_cents,
        granted_by=granted_by,
        admin_user_id=admin_user_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
    )
    db.add(purchase)
    db.commit()
    return purchase

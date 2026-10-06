"""Reserving/refunding tokens against a user's balance, granting new ones and taking them back (ADR-0043).

The token balance is the sole spending control for the AI answer check (ADR-0044 dropped the
separate weekly budget this used to sit alongside) — `lotse_check.run_paid_check` reserves a
check's cost (1 token for a catalog question, 2 for a Kartenaufgabe) and refunds it if the LLM
call fails.
"""

from sqlalchemy.orm import Session

from app.models.purchase import Purchase
from app.services.user import locked_user

TOKENS_PER_ANSWER_CHECK = 1
# A Kartenaufgabe's check runs on a stronger model with a much longer prompt (ADR-0058).
TOKENS_PER_CHART_CHECK = 2


def reserve(db: Session, user_id: int, amount: int = TOKENS_PER_ANSWER_CHECK) -> int | None:
    """Spend one check's worth of tokens. Returns tokens left, or None if the balance is too low."""
    user = locked_user(db, user_id)
    if user.token_balance < amount:
        db.commit()
        return None
    user.token_balance -= amount
    db.commit()
    return user.token_balance


def refund(db: Session, user_id: int, amount: int = TOKENS_PER_ANSWER_CHECK) -> None:
    """Give back reserved tokens (the LLM call failed) — a check that never happened costs nothing."""
    user = locked_user(db, user_id)
    user.token_balance += amount
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


def debit(db: Session, user_id: int, *, tokens: int, admin_user_id: int) -> int:
    """Take up to `tokens` back from the balance (never below 0) and record it in the ledger.

    Returns how many were actually taken. A refund or chargeback of a package the learner has
    partly used takes what's left; nothing to take writes no ledger row. The row has no amount
    (`amount_eur_cents=None`): the money side of a refund is Stripe's record, not ours.
    """
    user = locked_user(db, user_id)
    taken = min(tokens, user.token_balance)
    if taken:
        user.token_balance -= taken
        db.add(
            Purchase(
                user_id=user_id,
                product="admin_debit",
                tokens_granted=-taken,
                amount_eur_cents=None,
                granted_by="admin_manual",
                admin_user_id=admin_user_id,
            )
        )
    db.commit()
    return taken

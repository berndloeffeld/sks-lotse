"""unique stripe_payment_intent_id on purchases

Revision ID: 9d4b2f6a8e13
Revises: 7c3e91a0d5f2
Create Date: 2026-09-25 14:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9d4b2f6a8e13"
down_revision: str | None = "7c3e91a0d5f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every existing row has NULL here (nothing wrote the column before the Stripe webhook,
    # ADR-0048), and NULLs don't collide in a unique constraint — safe while the old code runs.
    op.create_unique_constraint(
        "uq_purchases_stripe_payment_intent_id", "purchases", ["stripe_payment_intent_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_purchases_stripe_payment_intent_id", "purchases", type_="unique")

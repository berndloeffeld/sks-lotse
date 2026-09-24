"""token-based monetization: token_balance, purchases ledger, drop ai_grading_enabled

Revision ID: 1f2fe299ee32
Revises: c8e3f5a72d41
Create Date: 2026-09-24 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1f2fe299ee32"
down_revision: str | None = "c8e3f5a72d41"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_balance", sa.Integer(), server_default="0", nullable=False))
    op.drop_column("users", "ai_grading_enabled")

    op.create_table(
        "purchases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("product", sa.String(length=32), nullable=False),
        sa.Column("tokens_granted", sa.Integer(), nullable=True),
        sa.Column("amount_eur_cents", sa.Integer(), nullable=True),
        sa.Column("granted_by", sa.String(length=32), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_purchases_user_id_created_at", "purchases", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_purchases_user_id_created_at", table_name="purchases")
    op.drop_table("purchases")
    op.add_column(
        "users",
        sa.Column("ai_grading_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.drop_column("users", "token_balance")

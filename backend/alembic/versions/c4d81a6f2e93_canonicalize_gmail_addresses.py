"""canonicalize existing Gmail/Googlemail account addresses

Revision ID: c4d81a6f2e93
Revises: e7a3c9d15b28
Create Date: 2026-09-20 12:00:00.000000

From now on every address is folded to one canonical form on input
(app/core/email_address.py: Gmail loses dots and `+tag`, googlemail.com becomes
gmail.com). Accounts created before that would no longer be found by their
own login, so their stored address is folded the same way. The logic is copied
here rather than imported so this migration stays stable if the app's changes.

An account whose canonical form is already taken by another account is left
alone (and reported): merging two people's data is not something a migration
should decide.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d81a6f2e93"
down_revision: str | None = "e7a3c9d15b28"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def _canonical(email: str) -> str:
    email = email.strip().lower()
    local, at, domain = email.rpartition("@")
    if not at or domain not in _GMAIL_DOMAINS:
        return email
    local = local.split("+", 1)[0].replace(".", "")
    return f"{local}@gmail.com" if local else email


def upgrade() -> None:
    bind = op.get_bind()
    users = sa.table("users", sa.column("id", sa.Integer), sa.column("email", sa.String))
    rows = bind.execute(sa.select(users.c.id, users.c.email)).all()
    taken = {email for _, email in rows}
    for user_id, email in rows:
        target = _canonical(email)
        if target == email:
            continue
        if target in taken:
            print(f"canonicalize_gmail: user {user_id} keeps its address, {target} is already taken")
            continue
        bind.execute(sa.update(users).where(users.c.id == user_id).values(email=target))
        taken.discard(email)
        taken.add(target)


def downgrade() -> None:
    # The original spelling isn't kept; the canonical address is still valid.
    pass

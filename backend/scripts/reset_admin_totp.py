"""Switch an admin's 2FA off, e.g. after losing the phone with the authenticator app (ADR-0047).

Clears the TOTP secret and ends every session of the account; the next visit to /admin starts a
new enrolment. Runs where the app's DATABASE_URL points — in production as a Render one-off job,
started by the "Reset admin 2FA" GitHub Action (docs/RUNBOOK.md → Reset an admin's 2FA).

    python -m scripts.reset_admin_totp --email admin@example.com
"""

import argparse
import sys

from sqlalchemy import select

from app.core.database import get_session_factory
from app.core.email_address import canonicalize_email
from app.models import User
from app.services import admin_mfa


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True)
    args = parser.parse_args(argv)
    email = canonicalize_email(args.email)

    with get_session_factory()() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            # Exit 0: nothing to reset is a fine end state, and the job log says why.
            print("No account with that email address — nothing to reset.")
            return 0
        if admin_mfa.reset(db, user):
            print(f"2FA reset for user {user.id}; all of its sessions have ended.")
        else:
            print(f"User {user.id} had no 2FA set up; its sessions have ended anyway.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

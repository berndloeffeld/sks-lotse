"""Seed a question's progress right at the "gelernt" boundary, for local manual QA of the
LearnedCelebration overlay (frontend/src/components/LearnedCelebration.tsx) without waiting on
real elapsed time.

One-off/local-only — not run in CI or production. Log in through the app first (OTP flow) so the
account exists, then run this against your local DATABASE_URL, then answer the named question
"Richtig" once in the running app to flip it to gelernt and see the overlay.

    python -m scripts.seed_almost_learned --email you@example.com
    python -m scripts.seed_almost_learned --email you@example.com --subject wetterkunde --number 11
"""

import argparse
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_session_factory
from app.core.email_address import canonicalize_email
from app.models import Question, QuestionProgress, User

# Half-life the next "Richtig" needs to start from so it clears LEARNED_HALF_LIFE_DAYS (7.0) in one
# step: FULL_GAIN (2.5) * 3.0 = 7.5. See app/core/progress.py.
SEED_HALF_LIFE_DAYS = 3.0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--subject", default="wetterkunde")
    parser.add_argument("--number", type=int, default=11)
    args = parser.parse_args(argv)
    if settings.is_production:
        # Rewrites a real learner's progress — a QA shortcut that must never touch production data.
        print("Refusing to run against production (ENVIRONMENT=production or on Render).")
        return 1
    email = canonicalize_email(args.email)

    with get_session_factory()() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            print(f"No account for {email} yet — log in once through the app first.")
            return 1

        question = db.execute(
            select(Question).where(Question.subject == args.subject, Question.number == args.number)
        ).scalar_one_or_none()
        if question is None:
            print(f"No question {args.subject} #{args.number}.")
            return 1

        row = db.execute(
            select(QuestionProgress).where(
                QuestionProgress.user_id == user.id, QuestionProgress.question_id == question.id
            )
        ).scalar_one_or_none()

        now = datetime.now(UTC)
        last_graded_at = now - timedelta(days=SEED_HALF_LIFE_DAYS, hours=1)
        if row is None:
            row = QuestionProgress(user_id=user.id, question_id=question.id)
            db.add(row)
        row.half_life_days = SEED_HALF_LIFE_DAYS
        row.last_graded_at = last_graded_at
        row.last_correct_at = last_graded_at
        row.streak_start_at = None
        row.review_due_at = now + timedelta(days=1)
        db.commit()

        print(
            f'Seeded: {args.subject} #{args.number} is one "Richtig" away from gelernt '
            f"for {email}. Answer it in the app to see the celebration."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

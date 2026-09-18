from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.question_progress import QuestionProgress
from app.models.user import User


def delete_user_and_progress(db: Session, user: User) -> None:
    # Deleted explicitly rather than relying on the question_progress.user_id
    # FK's ondelete="CASCADE": that fires reliably on Postgres (production),
    # but SQLite (used by the test suite) only enforces FK actions when
    # PRAGMA foreign_keys=ON is set on the connection, which app/core/database.py
    # doesn't do — an ORM-level session.delete(user) alone can't be trusted to
    # cascade under both engines.
    db.execute(delete(QuestionProgress).where(QuestionProgress.user_id == user.id))
    db.delete(user)
    db.commit()

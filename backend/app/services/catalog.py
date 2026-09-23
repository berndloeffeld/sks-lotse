"""The question catalog as the API serves it: read once, cached in-process (ADR-0009).

Shared by every router that needs catalog rows (questions, progress, the AI check), so none of
them reaches into another router's internals for it.
"""

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core import cache
from app.core.config import settings
from app.models.question import Question
from app.schemas.question import QuestionRead

CATALOG_CACHE_KEY = "questions:catalog"
_CATALOG_BY_ID_CACHE_KEY = "questions:catalog_by_id"
# Subjects with no assigned topic (or not yet classified) sort after every topic within their subject.
_NO_TOPIC_ORDER = 1_000_000


def catalog(request: Request, db: Session) -> list[QuestionRead]:
    """Every question, ordered by subject, topic and number."""

    def load() -> list[QuestionRead]:
        stmt = select(Question).options(joinedload(Question.topic))
        questions = db.execute(stmt).unique().scalars().all()
        questions = sorted(
            questions,
            key=lambda q: (q.subject, q.topic.display_order if q.topic else _NO_TOPIC_ORDER, q.number),
        )
        return [QuestionRead.model_validate(q) for q in questions]

    # The catalog only ever changes via the catalog-seed data migrations (app/services/catalog_seed.py,
    # or backend/scripts/import_catalog.py locally), never through the API — this TTL just bounds how
    # long those changes take to show up without restarting the app, not a correctness requirement.
    return cache.get_or_set(request.app, CATALOG_CACHE_KEY, settings.catalog_cache_ttl_seconds, load)


def catalog_by_id(request: Request, db: Session) -> dict[int, QuestionRead]:
    return cache.get_or_set(
        request.app,
        _CATALOG_BY_ID_CACHE_KEY,
        settings.catalog_cache_ttl_seconds,
        lambda: {q.id: q for q in catalog(request, db)},
    )

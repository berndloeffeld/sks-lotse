from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _engine_kwargs(url: str) -> dict:
    # pool_pre_ping: test a pooled connection before handing it out, so one the
    # server side has since dropped (idle timeout, DB restart/maintenance) gets
    # replaced transparently instead of failing the request with a 500.
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("postgresql"):
        kwargs.update(
            # Recycle before any server/proxy idle cutoff; fail a request after 10 s waiting for a
            # pooled connection rather than Starlette's threads piling up behind an exhausted pool.
            pool_recycle=1800,
            pool_timeout=10,
            # A slow query or an unreachable database fails the request (and /health) within seconds,
            # instead of holding a connection and a worker thread indefinitely. Alembic builds its own
            # engine (alembic/env.py), so migrations and the catalog seed aren't bound by this.
            connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"},
        )
    return kwargs


engine = create_engine(settings.database_url, **_engine_kwargs(settings.database_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> sessionmaker[Session]:
    # For work that outlives the request, e.g. a BackgroundTasks job: it must
    # open (and close) its own session rather than borrow get_db's, whose
    # lifetime is tied to the request. A dependency rather than a direct
    # SessionLocal import so tests can point it at their own engine.
    return SessionLocal

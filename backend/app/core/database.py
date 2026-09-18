from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# pool_pre_ping: test a pooled connection before handing it out, so one the
# server side has since dropped (idle timeout, DB restart/maintenance) gets
# replaced transparently instead of failing the request with a 500.
engine = create_engine(settings.database_url, pool_pre_ping=True)
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

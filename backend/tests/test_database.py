import pytest

from app.core.database import get_db


def test_get_db_yields_a_session_and_closes_it():
    gen = get_db()
    db = next(gen)
    assert db is not None
    with pytest.raises(StopIteration):
        next(gen)


def test_engine_pre_pings_pooled_connections():
    # A connection Postgres dropped while it sat idle in the pool must be
    # replaced on checkout, not surface as a 500 on the next request.
    from app.core.database import engine

    assert engine.pool._pre_ping is True


def test_postgres_engines_get_timeouts_and_other_dialects_only_the_pre_ping():
    from app.core.database import _engine_kwargs

    pg = _engine_kwargs("postgresql://u:p@h/db")
    assert pg["pool_pre_ping"] is True
    assert pg["pool_timeout"] == 10
    assert pg["pool_recycle"] == 1800
    assert pg["connect_args"] == {"connect_timeout": 5, "options": "-c statement_timeout=15000"}
    # SQLite (tests, scripts) rejects psycopg's connect_args.
    assert _engine_kwargs("sqlite:///:memory:") == {"pool_pre_ping": True}

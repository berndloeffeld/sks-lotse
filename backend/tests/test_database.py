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

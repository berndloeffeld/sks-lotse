import pytest

from app.core.database import get_db


def test_get_db_yields_a_session_and_closes_it():
    gen = get_db()
    db = next(gen)
    assert db is not None
    with pytest.raises(StopIteration):
        next(gen)

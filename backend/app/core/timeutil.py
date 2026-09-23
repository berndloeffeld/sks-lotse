from datetime import UTC, datetime


def as_utc(value: datetime) -> datetime:
    """A timestamp read back from the database, as an aware UTC datetime.

    Every timestamp the app writes is UTC. Postgres returns `DateTime(timezone=True)` columns
    aware; SQLite (the test database) returns them naive — those are UTC too.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)

from unittest.mock import MagicMock

from sqlalchemy.exc import OperationalError

from app.core.database import get_session_factory
from app.main import app


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_503_when_database_is_unreachable(client):
    broken_session = MagicMock()
    error = OperationalError("SELECT 1", {}, Exception("down"))
    broken_session.__enter__.return_value.execute.side_effect = error
    app.dependency_overrides[get_session_factory] = lambda: lambda: broken_session

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}

from app.core.config import settings
from app.main import _docs_kwargs


def test_docs_kwargs_empty_when_not_production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    assert _docs_kwargs() == {}


def test_docs_kwargs_disables_docs_in_production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    assert _docs_kwargs() == {"docs_url": None, "redoc_url": None, "openapi_url": None}


def test_docs_reachable_by_default(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200

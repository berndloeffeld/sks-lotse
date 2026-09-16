from app.core.security import settings


def test_gate_disabled_by_default(client):
    response = client.get("/api/v1/questions")
    assert response.status_code == 200


def test_gate_rejects_missing_or_wrong_key(client, monkeypatch):
    monkeypatch.setattr(settings, "access_gate_key", "secret123")

    response = client.get("/api/v1/questions")
    assert response.status_code == 401

    response = client.get("/api/v1/questions", headers={"X-Access-Key": "wrong"})
    assert response.status_code == 401


def test_gate_accepts_correct_key(client, monkeypatch):
    monkeypatch.setattr(settings, "access_gate_key", "secret123")

    response = client.get("/api/v1/questions", headers={"X-Access-Key": "secret123"})
    assert response.status_code == 200

import inspect

import anthropic
import httpx
import pytest

from app.api.v1 import grading as grading_api
from app.core.config import settings
from app.core.jwt import create_access_token
from app.models import Question, User
from app.services import grader
from app.services.grader import GradeResult, GradingUnavailable


def _question(db_session, answer_text="Backbord ist links.") -> Question:
    q = Question(subject="navigation", number=1, question_text="Was ist Backbord?", answer_text=answer_text)
    db_session.add(q)
    db_session.commit()
    return q


def _headers(db_session, *, enabled: bool, email="grader@example.com") -> dict[str, str]:
    user = User(email=email, ai_grading_enabled=enabled)
    db_session.add(user)
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(user.id, user.token_version)}"}


def _post(client, question_id, headers, answer="a"):
    return client.post(f"/api/v1/questions/{question_id}/ai-grade", json={"answer": answer}, headers=headers)


@pytest.fixture()
def fake_grader(monkeypatch):
    calls = []

    def fake(question_text, model_answer, learner_answer):
        calls.append((question_text, model_answer, learner_answer))
        return GradeResult(outcome="teilweise_richtig", feedback="Es fehlt die Seite.")

    monkeypatch.setattr(grading_api, "grade_answer", fake)
    return calls


def test_requires_auth(client):
    assert client.post("/api/v1/questions/1/ai-grade", json={"answer": "x"}).status_code == 401


def test_not_unlocked_is_403(client, db_session):
    q = _question(db_session)
    headers = _headers(db_session, enabled=False)
    assert _post(client, q.id, headers, "links").status_code == 403


def test_happy_path_sends_only_question_and_answers(client, db_session, fake_grader):
    q = _question(db_session)
    headers = _headers(db_session, enabled=True)
    response = _post(client, q.id, headers, "  links  ")
    assert response.status_code == 200
    assert response.json() == {"outcome": "teilweise_richtig", "feedback": "Es fehlt die Seite."}
    assert fake_grader == [("Was ist Backbord?", "Backbord ist links.", "links")]


def test_validation_and_missing_question(client, db_session, fake_grader):
    q = _question(db_session)
    headers = _headers(db_session, enabled=True)
    assert _post(client, q.id, headers, "   ").status_code == 422
    too_long = "x" * (settings.grading_max_answer_chars + 1)
    assert _post(client, q.id, headers, too_long).status_code == 422
    assert _post(client, 9999, headers).status_code == 404
    assert fake_grader == []


def test_question_without_text_answer_is_409(client, db_session, fake_grader):
    q = _question(db_session, answer_text="")
    headers = _headers(db_session, enabled=True)
    assert _post(client, q.id, headers).status_code == 409


def test_per_user_limit_is_429(client, db_session, fake_grader, monkeypatch):
    monkeypatch.setattr(settings, "grading_max_per_window", 1)
    q = _question(db_session)
    headers = _headers(db_session, enabled=True)
    assert _post(client, q.id, headers).status_code == 200
    assert _post(client, q.id, headers).status_code == 429


def test_unavailable_is_503(client, db_session, monkeypatch):
    def boom(*args):
        raise GradingUnavailable("APIError")

    monkeypatch.setattr(grading_api, "grade_answer", boom)
    q = _question(db_session)
    headers = _headers(db_session, enabled=True)
    assert _post(client, q.id, headers).status_code == 503


# --- service ---------------------------------------------------------------


class _FakeMessages:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.kwargs = result, error, None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self.result


class _FakeResponse:
    def __init__(self, parsed_output):
        self.parsed_output = parsed_output


def _patch_client(monkeypatch, messages):
    monkeypatch.setattr(settings, "anthropic_grading_api_key", "test-key")
    monkeypatch.setattr(grader, "_client", lambda: type("C", (), {"messages": messages})())


def test_service_builds_minimal_prompt(monkeypatch):
    expected = GradeResult(outcome="richtig", feedback="Passt.")
    messages = _FakeMessages(_FakeResponse(expected))
    _patch_client(monkeypatch, messages)
    assert grader.grade_answer("F", "M", "A") == expected
    kwargs = messages.kwargs
    assert kwargs["model"] == settings.anthropic_grading_model
    assert kwargs["max_tokens"] == 300
    # A mock accepts anything, the real SDK doesn't (it once rejected `temperature`).
    assert set(kwargs) <= set(inspect.signature(anthropic.resources.messages.Messages.parse).parameters)
    assert kwargs["messages"] == [
        {
            "role": "user",
            "content": "<frage>F</frage>\n<musterantwort>M</musterantwort>\n<antwort>A</antwort>",
        }
    ]


def test_service_without_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_grading_api_key", "")
    with pytest.raises(GradingUnavailable):
        grader.grade_answer("F", "M", "A")


def test_service_wraps_api_errors_and_empty_replies(monkeypatch):
    error = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com"))
    _patch_client(monkeypatch, _FakeMessages(error=error))
    with pytest.raises(GradingUnavailable):
        grader.grade_answer("F", "M", "A")
    _patch_client(monkeypatch, _FakeMessages(_FakeResponse(None)))
    with pytest.raises(GradingUnavailable):
        grader.grade_answer("F", "M", "A")


def test_client_factory_uses_configured_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_grading_api_key", "test-key")
    assert grader._client().api_key == "test-key"

from app.core.config import settings
from scripts import seed_almost_learned


def test_refuses_to_run_in_production(monkeypatch, capsys):
    monkeypatch.setattr(settings, "environment", "production")

    def no_db():
        raise AssertionError("must not open a session in production")

    monkeypatch.setattr(seed_almost_learned, "get_session_factory", no_db)

    assert seed_almost_learned.main(["--email", "you@example.com"]) == 1
    assert "production" in capsys.readouterr().out


def test_refuses_to_run_on_render(monkeypatch, capsys):
    monkeypatch.setattr(settings, "render", True)
    monkeypatch.setattr(seed_almost_learned, "get_session_factory", lambda: None)

    assert seed_almost_learned.main(["--email", "you@example.com"]) == 1

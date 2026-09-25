import pytest

from app.core.config import Settings, settings
from app.services import email as email_service


@pytest.fixture()
def sent(monkeypatch):
    calls = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda params: calls.append(params))
    return calls


def test_login_code_email_is_german_with_html_and_text_parts(sent):
    email_service.send_otp_email("learner@example.com", "123456")

    [params] = sent
    assert params["to"] == "learner@example.com"
    assert params["from"] == settings.email_from_address
    assert params["subject"] == "Dein Anmeldecode für SKS Lotse"
    assert "<strong>123456</strong>" in params["html"]
    assert "123456" in params["text"]
    assert f"{settings.otp_ttl_minutes} Minuten gültig" in params["text"]
    # Branded: header band with the wordmark and icon, the legal footer, all on the canonical origin.
    origin = settings.cors_allowed_origins[0]
    assert "SKS Lotse" in params["html"]
    assert f"{origin}/icon-192.png" in params["html"]
    for path in ("/terms", "/privacy", "/imprint"):
        assert f"{origin}{path}" in params["html"]


def test_every_mail_footer_links_the_legal_pages_in_readable_white(sent):
    email_service.send_otp_email("learner@example.com", "123456")

    [params] = sent
    origin = settings.cors_allowed_origins[0]
    # The Impressum must be one click away from a commercial mail; white because the band is dark
    # (a grey link on it was unreadable once).
    for label, path in (("AGB", "/terms"), ("Datenschutz", "/privacy"), ("Impressum", "/imprint")):
        link = f'<a href="{origin}{path}" style="color:#ffffff;text-decoration:underline">{label}</a>'
        assert link in params["html"]


def test_the_api_key_is_handed_to_resend(monkeypatch):
    monkeypatch.setattr(email_service.resend, "api_key", None)
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda params: None)

    email_service._send("a@b.de", "Betreff", html="<p>x</p>", text="x")

    assert email_service.resend.api_key == "re_test_key"


def test_email_change_email_uses_confirmation_copy(sent):
    email_service.send_email_change_otp_email("new@example.com", "654321")

    [params] = sent
    assert params["to"] == "new@example.com"
    assert params["subject"] == "Bestätige deine neue E-Mail-Adresse für SKS Lotse"
    assert "Bestätigungscode" in params["text"]
    assert "Anmeldecode" not in params["text"]
    assert "654321" in params["text"]
    assert "<strong>654321</strong>" in params["html"]
    assert "Neue E-Mail-Adresse bestätigen" in params["html"]


def test_default_sender_shows_the_product_name():
    assert Settings.model_fields["email_from_address"].default == "SKS Lotse <noreply@sks-lotse.de>"

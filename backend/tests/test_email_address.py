import pytest

from app.core.config import Settings
from app.core.email_address import canonicalize_email


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Learner@Example.DE", "learner@example.de"),
        ("a.b+sailing@gmail.com", "ab@gmail.com"),
        ("AB@GoogleMail.com", "ab@gmail.com"),
        ("ab@gmail.com", "ab@gmail.com"),
        # Dots and plus are significant everywhere else.
        ("a.b+x@example.de", "a.b+x@example.de"),
        ("a.b@gmail.com.evil.de", "a.b@gmail.com.evil.de"),
        # Nothing left of the local part: keep the address as typed.
        ("+x@gmail.com", "+x@gmail.com"),
        ("no-at-sign", "no-at-sign"),
    ],
)
def test_canonicalize_email(raw, expected):
    assert canonicalize_email(raw) == expected


def test_allowlists_are_canonicalized_too():
    settings = Settings(
        database_url="sqlite://",
        jwt_secret="x" * 32,
        allowed_emails="A.B+x@googlemail.com, other@example.de",
        admin_emails="Boss.Man@gmail.com",
    )

    assert settings.allowed_emails_set == {"ab@gmail.com", "other@example.de"}
    assert settings.admin_emails_set == {"bossman@gmail.com"}

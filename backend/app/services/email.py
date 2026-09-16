import resend

from app.core.config import settings


def send_otp_email(to_email: str, code: str) -> None:
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from_address,
            "to": to_email,
            "subject": "Your SKS Lotse login code",
            "html": (
                f"<p>Your login code is <strong>{code}</strong>. "
                f"It expires in {settings.otp_ttl_minutes} minutes.</p>"
            ),
        }
    )

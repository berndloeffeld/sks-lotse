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


def send_email_change_otp_email(to_email: str, code: str) -> None:
    # Same mechanics as send_otp_email, but distinct copy: this recipient
    # isn't logging in, they're confirming a new address for an existing
    # account, and "your login code" would be misleading.
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from_address,
            "to": to_email,
            "subject": "Confirm your new SKS Lotse email address",
            "html": (
                f"<p>Your confirmation code is <strong>{code}</strong>. "
                f"It expires in {settings.otp_ttl_minutes} minutes.</p>"
            ),
        }
    )

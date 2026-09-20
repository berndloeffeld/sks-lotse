from html import escape

import resend

from app.core.config import settings


def _send_code_email(to_email: str, subject: str, intro: str, code: str) -> None:
    # German copy, like the rest of the app. A plain-text part alongside the
    # HTML one: some clients prefer it, and HTML-only mail scores worse with
    # spam filters.
    validity = f"Der Code ist {settings.otp_ttl_minutes} Minuten gültig."
    outro = "Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren."
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from_address,
            "to": to_email,
            "subject": subject,
            "html": (
                f"<p>{escape(intro)} <strong>{escape(code)}</strong></p>"
                f"<p>{escape(validity)}</p>"
                f"<p>{escape(outro)}</p>"
            ),
            "text": f"{intro} {code}\n\n{validity}\n\n{outro}\n",
        }
    )


def send_otp_email(to_email: str, code: str) -> None:
    _send_code_email(to_email, "Dein Anmeldecode für SKS Lotse", "Dein Anmeldecode lautet:", code)


def send_email_change_otp_email(to_email: str, code: str) -> None:
    # Distinct copy from send_otp_email: this recipient isn't logging in,
    # they're confirming a new address for an existing account, and "your
    # login code" would be misleading.
    _send_code_email(
        to_email,
        "Bestätige deine neue E-Mail-Adresse für SKS Lotse",
        "Dein Bestätigungscode lautet:",
        code,
    )


def send_kpi_report_email(to_email: str, subject: str, body: str) -> None:
    # Operator-facing (ADMIN_EMAILS), aggregates only. Monospace <pre> keeps
    # the plain-text layout of the report in the HTML part.
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from_address,
            "to": to_email,
            "subject": subject,
            "html": f'<pre style="font-family:monospace;font-size:14px">{escape(body)}</pre>',
            "text": body,
        }
    )

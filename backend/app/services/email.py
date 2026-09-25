from html import escape

import resend

from app.core.config import settings

# The SDK's default client waits 30 s. OTP mails go out in a background task, where a hanging
# send would still hold a worker thread — 10 s is plenty for one API call.
resend.default_http_client = resend.http_client_requests.RequestsClient(timeout=10)


def _send(to_email: str, subject: str, html: str, text: str) -> None:
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {"from": settings.email_from_address, "to": to_email, "subject": subject, "html": html, "text": text}
    )


def _send_code_email(to_email: str, subject: str, intro: str, code: str) -> None:
    # German copy, like the rest of the app. A plain-text part alongside the
    # HTML one: some clients prefer it, and HTML-only mail scores worse with
    # spam filters.
    validity = f"Der Code ist {settings.otp_ttl_minutes} Minuten gültig."
    outro = "Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren."
    _send(
        to_email,
        subject,
        html=(
            f"<p>{escape(intro)} <strong>{escape(code)}</strong></p>"
            f"<p>{escape(validity)}</p>"
            f"<p>{escape(outro)}</p>"
        ),
        text=f"{intro} {code}\n\n{validity}\n\n{outro}\n",
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


def send_purchase_confirmation_email(
    to_email: str, *, package: str, tokens: int, amount: str, paid_at: str, reference: str, terms_url: str
) -> None:
    # The confirmation on a durable medium that § 312f Abs. 3 / § 356 Abs. 5 Nr. 2 BGB require after
    # the learner waived the right of withdrawal at checkout (ADR-0048): the contract content, the
    # waiver, and where the AGB are.
    subject = f"Deine Bestellung bei SKS Lotse: {package}"
    lines = [
        "Danke für deinen Kauf bei SKS Lotse! Die Tokens wurden deinem Konto gutgeschrieben.",
        f"Bestellung: {package} ({tokens} Tokens für den Lotsen-Check)",
        f"Preis: {amount} (Endpreis; gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen)",
        f"Zahlung am: {paid_at}",
        f"Zahlungsreferenz: {reference}",
        "Einmalkauf, kein Abo, keine wiederkehrende Zahlung.",
        "Du hast ausdrücklich zugestimmt, dass wir die Tokens sofort nach der Zahlung bereitstellen, und "
        "hast zur Kenntnis genommen, dass dein Widerrufsrecht damit erlischt (§ 356 Abs. 5 BGB).",
        f"Unsere AGB: {terms_url}",
    ]
    html = "".join(f"<p>{escape(line)}</p>" for line in lines)
    _send(to_email, subject, html=html, text="\n\n".join(lines) + "\n")


def send_kpi_report_email(to_email: str, subject: str, body: str) -> None:
    # Operator-facing (ADMIN_EMAILS), aggregates only. Monospace <pre> keeps
    # the plain-text layout of the report in the HTML part.
    html = f'<pre style="font-family:monospace;font-size:14px">{escape(body)}</pre>'
    _send(to_email, subject, html=html, text=body)

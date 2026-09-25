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


# Brand colours of the web app (frontend/src/index.css), inlined: mail clients ignore stylesheets.
_BG, _INK, _INK_SOFT = "#e9f0f3", "#1e2a32", "#5b6670"
_PRIMARY, _PRIMARY_DARK, _SUCCESS, _ACCENT = "#1f6f78", "#164f56", "#3d7a5c", "#b8763c"
_SERIF = "Georgia, 'Times New Roman', serif"
_SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
# Same address as frontend/src/contact.ts.
_CONTACT_EMAIL = "kontakt@sks-lotse.de"


def _purchase_confirmation_html(rows: list[tuple[str, str]], waiver: str, base_url: str) -> str:
    def link(path: str, label: str) -> str:
        style = "color:#ffffff;text-decoration:underline"
        return f'<a href="{escape(base_url)}{path}" style="{style}">{label}</a>'

    table_rows = "".join(
        f'<tr><td style="padding:6px 0;color:{_INK_SOFT};font-size:13px;vertical-align:top;width:38%">'
        f'{escape(label)}</td><td style="padding:6px 0;color:{_INK};font-size:14px">{escape(value)}</td></tr>'
        for label, value in rows
    )
    return (
        f'<div style="margin:0;padding:24px 12px;background:{_BG};font-family:{_SANS}">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #b9c9d0">'
        f'<tr><td style="background:{_PRIMARY_DARK};padding:18px 24px">'
        f'<img src="{escape(base_url)}/icon-192.png" width="32" height="32" alt="" '
        f'style="vertical-align:middle;border:0;margin-right:10px">'
        f'<span style="font-family:{_SERIF};font-size:22px;color:#ffffff;'
        f'vertical-align:middle">SKS Lotse</span>'
        f"</td></tr>"
        f'<tr><td style="padding:28px 24px 8px">'
        f'<h1 style="margin:0 0 8px;font-family:{_SERIF};font-size:24px;font-weight:normal;'
        f'color:{_PRIMARY_DARK}">'
        f"Danke für deinen Kauf!</h1>"
        f'<p style="margin:0;font-size:15px;line-height:1.5;color:{_SUCCESS}"><strong>'
        f"✓ Die Tokens wurden deinem Konto gutgeschrieben.</strong></p></td></tr>"
        f'<tr><td style="padding:16px 24px"><table role="presentation" width="100%" cellpadding="0" '
        f'cellspacing="0" style="background:{_BG};padding:8px 16px;border-left:4px solid {_PRIMARY}">'
        f"{table_rows}</table></td></tr>"
        f'<tr><td style="padding:0 24px 8px"><p style="margin:0;padding:10px 14px;font-size:13px;'
        f"line-height:1.5;"
        f'color:{_INK};border-left:4px solid {_ACCENT};background:#fbf5ee">{escape(waiver)}</p></td></tr>'
        f'<tr><td align="center" style="padding:20px 24px 28px">'
        f'<a href="{escape(base_url)}/learn" style="display:inline-block;padding:12px 26px;'
        f"background:{_PRIMARY};"
        f'color:#ffffff;text-decoration:none;font-size:14px;letter-spacing:.04em;text-transform:uppercase">'
        f"Weiterlernen</a></td></tr>"
        f'<tr><td style="background:{_PRIMARY_DARK};padding:16px 24px;font-size:12px;'
        f'line-height:1.6;color:#d8e4e9">'
        f"SKS Lotse · Lernen für die SKS-Theorieprüfung<br>"
        f'<span style="color:#d8e4e9">{link("/terms", "AGB")} · {link("/privacy", "Datenschutz")} · '
        f"{link('/imprint', 'Impressum')} · "
        f'<a href="mailto:{_CONTACT_EMAIL}" style="color:#ffffff;text-decoration:underline">'
        f"{_CONTACT_EMAIL}</a></span></td></tr></table></div>"
    )


def send_purchase_confirmation_email(
    to_email: str, *, package: str, tokens: int, amount: str, paid_at: str, reference: str, base_url: str
) -> None:
    # The confirmation on a durable medium that § 312f Abs. 3 / § 356 Abs. 5 Nr. 2 BGB require after
    # the learner waived the right of withdrawal at checkout (ADR-0048): the contract content, the
    # waiver, and where the AGB are. `base_url` is the canonical frontend origin.
    subject = f"Deine Bestellung bei SKS Lotse: {package}"
    rows = [
        ("Bestellung", f"{package}: {tokens} Tokens für den Lotsen-Check"),
        ("Preis", f"{amount} (Endpreis; gemäß § 19 UStG keine Umsatzsteuer ausgewiesen)"),
        ("Zahlung am", paid_at),
        ("Zahlungsreferenz", reference),
        ("Art des Kaufs", "Einmalkauf, kein Abo, keine wiederkehrende Zahlung"),
    ]
    waiver = (
        "Du hast ausdrücklich zugestimmt, dass wir die Tokens sofort nach der Zahlung bereitstellen, "
        "und hast zur Kenntnis genommen, dass dein Widerrufsrecht damit erlischt (§ 356 Abs. 5 BGB)."
    )
    text = "\n\n".join(
        [
            "Danke für deinen Kauf bei SKS Lotse! Die Tokens wurden deinem Konto gutgeschrieben.",
            "\n".join(f"{label}: {value}" for label, value in rows),
            waiver,
            f"Unsere AGB: {base_url}/terms",
            f"SKS Lotse · {_CONTACT_EMAIL}",
        ]
    )
    _send(to_email, subject, html=_purchase_confirmation_html(rows, waiver, base_url), text=text + "\n")


def send_kpi_report_email(to_email: str, subject: str, body: str) -> None:
    # Operator-facing (ADMIN_EMAILS), aggregates only. Monospace <pre> keeps
    # the plain-text layout of the report in the HTML part.
    html = f'<pre style="font-family:monospace;font-size:14px">{escape(body)}</pre>'
    _send(to_email, subject, html=html, text=body)

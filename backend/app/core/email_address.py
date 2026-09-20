"""One canonical form per mailbox, so one mailbox can't become many accounts.

Every per-email check (OTP quotas, the ALLOWED_EMAILS allowlist, the unique
users.email lookup) keys on this form. Gmail delivers `a.b+x@gmail.com`,
`ab@googlemail.com` and `ab@gmail.com` to the same inbox, so without folding
them one person could mint unlimited "different" addresses and dodge the
allowlist and the per-address quotas.

Deliberately imports nothing from app.core.config (which uses it for the
allowlists).
"""

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}
CANONICAL_GMAIL_DOMAIN = "gmail.com"


def canonicalize_email(email: str) -> str:
    """Lowercase; for Gmail/Googlemail also drop dots and a `+tag`, and use gmail.com."""
    email = email.strip().lower()
    local, at, domain = email.rpartition("@")
    if not at or domain not in GMAIL_DOMAINS:
        return email
    local = local.split("+", 1)[0].replace(".", "")
    if not local:
        return email
    return f"{local}@{CANONICAL_GMAIL_DOMAIN}"

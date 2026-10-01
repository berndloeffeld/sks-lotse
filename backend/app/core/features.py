"""Who may use the Kartenaufgaben right now — the CHART_EXERCISES feature flag (ADR-0052).

Like STRIPE_CHECKOUT (app/core/checkout.py): "off", "admins" (the ADMIN_EMAILS allowlist) or "on".
`UserRead` exposes the answer so the frontend shows or hides the feature; the routes check it too
(app/api/v1/chart_exercises.py).
"""

from app.core.config import settings
from app.core.email_address import canonicalize_email


def chart_exercises_enabled_for(email: str) -> bool:
    if settings.chart_exercises == "on":
        return True
    return settings.chart_exercises == "admins" and canonicalize_email(email) in settings.admin_emails_set

"""Who may buy token packages right now — the STRIPE_CHECKOUT feature flag (ADR-0048).

Kept apart from app/services/payments.py (which talks to Stripe) because `UserRead` needs it too,
to tell the frontend whether to show the buy buttons.
"""

from app.core.config import settings


def stripe_product_id(product: str) -> str:
    """The Stripe product id configured for a token package, "" if none is (or the product is unknown)."""
    return {
        "tokens_s": settings.stripe_product_tokens_s,
        "tokens_m": settings.stripe_product_tokens_m,
        "tokens_l": settings.stripe_product_tokens_l,
        "tokens_xl": settings.stripe_product_tokens_xl,
    }.get(product, "")


def checkout_open_to_everyone() -> bool:
    """The flag is "on" and Stripe is configured — what the unauthenticated pricing page shows."""
    return settings.stripe_checkout == "on" and bool(settings.stripe_secret_key)


def checkout_enabled_for(email: str) -> bool:
    """Whether this account may start a checkout. Fails closed without a Stripe secret key."""
    if not settings.stripe_secret_key:
        return False
    if settings.stripe_checkout == "on":
        return True
    return settings.stripe_checkout == "admins" and email in settings.admin_emails_set

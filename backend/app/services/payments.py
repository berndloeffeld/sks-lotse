"""Buying token packages via Stripe Hosted Checkout (ADR-0048).

Two halves: `create_checkout_url` opens a Checkout Session for a package and returns the Stripe
page to redirect to; `fulfil_checkout_session` credits the tokens once Stripe reports the session
paid (the webhook in app/api/v1/payments.py). Nothing is credited on the success redirect itself —
the learner can reach that URL without having paid.

The price is sent inline (`price_data`) from app_settings rather than as a Stripe Price id, so
/admin/settings stays the single place prices are set; the Stripe product only carries the name,
description and image (docs/stripe/README.md).
"""

import logging
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import stripe
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import pricing as pricing_core
from app.core.checkout import stripe_product_id
from app.core.config import settings
from app.models.purchase import Purchase
from app.models.user import User
from app.services import email as email_service
from app.services import token_wallet

logger = logging.getLogger(__name__)

# The events that can mean "paid": `completed` for card payments (paid at once), and
# `async_payment_succeeded` for delayed methods whose `completed` still says "unpaid".
FULFILMENT_EVENTS = frozenset({"checkout.session.completed", "checkout.session.async_payment_succeeded"})


class CheckoutUnavailable(Exception):
    """Stripe couldn't open a Checkout Session (not configured for this package, API/network error)."""


class InvalidWebhook(Exception):
    """The webhook payload isn't a genuine Stripe event (bad or missing signature, not JSON)."""


def build_checkout_params(
    user: User, package: pricing_core.TokenPackage, product_id: str, origin: str
) -> dict[str, Any]:
    """The Checkout Session parameters for one token package.

    The fixed settings (ui_mode … origin_context) are the ones configured in Stripe's Checkout
    Studio — keep them as they are. `mode="payment"`: a package is a one-time purchase, so no
    `payment_method_collection` (subscriptions only). The package's token amount goes into the
    metadata at this point, so a price/amount change in /admin/settings while the learner is on
    the Stripe page doesn't change what they get.
    """
    return {
        "ui_mode": "hosted_page",
        "billing_address_collection": "auto",
        "phone_number_collection": {"enabled": False},
        "automatic_tax": {"enabled": False},
        "allow_promotion_codes": False,
        "submit_type": "auto",
        "integration_identifier": "hosted_web_0001",
        "origin_context": "web",
        "mode": "payment",
        "line_items": [
            {
                "price_data": {"currency": "eur", "product": product_id, "unit_amount": package.price_cents},
                "quantity": 1,
            }
        ],
        "customer_email": user.email,
        "client_reference_id": str(user.id),
        "metadata": {
            "user_id": str(user.id),
            "product": package.product,
            "tokens": str(package.tokens),
            # The learner ticked the § 356 Abs. 5 BGB box (the request is refused otherwise) —
            # recorded on the session, which Stripe keeps alongside the payment.
            "withdrawal_waiver": "accepted",
        },
        "success_url": f"{origin}/pricing?checkout=success&product={package.product}",
        "cancel_url": f"{origin}/pricing?checkout=cancelled",
    }


def _client() -> stripe.StripeClient:
    # No stripe_version: the SDK's own pinned API version is used.
    return stripe.StripeClient(settings.stripe_secret_key)


def create_checkout_url(db: Session, user: User, product: str) -> str:
    """Open a Checkout Session for `product` and return the Stripe-hosted page's URL."""
    product_id = stripe_product_id(product)
    if not product_id:
        raise CheckoutUnavailable(f"no Stripe product id configured for {product}")
    package = pricing_core.token_package(db, product)
    params = build_checkout_params(user, package, product_id, settings.cors_allowed_origins[0])
    try:
        session = _client().v1.checkout.sessions.create(params=params)  # type: ignore[arg-type]  # a plain dict, the SDK's TypedDict is structural
    except stripe.StripeError as exc:
        raise CheckoutUnavailable(f"Stripe error: {exc.__class__.__name__}") from exc
    if not session.url:
        raise CheckoutUnavailable("Stripe returned a session without a URL")
    return session.url


def parse_webhook(payload: bytes, signature: str | None) -> stripe.Event:
    """Verify the Stripe-Signature header and return the event."""
    try:
        return stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise InvalidWebhook(exc.__class__.__name__) from exc


# Called after a session's tokens were credited, with (email, product, tokens, amount_cents,
# payment_intent) — the webhook hands it a background task that sends the confirmation mail.
CreditedCallback = Callable[[str, str, int, int | None, str], None]


def _euro(cents: int | None) -> str:
    return "-" if cents is None else f"{cents / 100:.2f}".replace(".", ",") + " €"


def send_purchase_confirmation(
    email: str, product: str, tokens: int, amount_cents: int | None, payment_intent: str
) -> None:
    """Mail the learner the confirmation of a paid package; a failed send is logged, never raised.

    The tokens are already credited when this runs, so a mail problem must not undo or fail the
    webhook — the log line is what to act on (docs/RUNBOOK.md → Stripe checkout).
    """
    letter = product.removeprefix("tokens_").upper()
    try:
        email_service.send_purchase_confirmation_email(
            email,
            package=f"Paket {letter}",
            tokens=tokens,
            amount=_euro(amount_cents),
            paid_at=datetime.now(UTC).astimezone(ZoneInfo("Europe/Berlin")).strftime("%d.%m.%Y, %H:%M Uhr"),
            reference=payment_intent,
            base_url=settings.cors_allowed_origins[0],
        )
    except Exception:
        logger.exception(
            "stripe payment %s: confirmation mail to user failed, send it by hand", payment_intent
        )


def fulfil_checkout_session(
    db: Session, session: Mapping[str, Any], on_credited: CreditedCallback | None = None
) -> bool:
    """Credit a paid session's tokens exactly once. Returns whether this call credited them.

    Safe to call for every delivery of every fulfilment event: an unpaid session is skipped (its
    `async_payment_succeeded` comes later), and a payment intent already in the ledger is skipped —
    the lookup catches a redelivery, the unique constraint a parallel one.
    """
    if session.get("payment_status") != "paid":
        return False
    payment_intent = session.get("payment_intent")
    metadata = session.get("metadata") or {}
    if not payment_intent or not metadata.get("user_id"):
        logger.error("stripe checkout session %s: paid but no payment intent/user id", session.get("id"))
        return False
    if db.scalar(select(Purchase.id).where(Purchase.stripe_payment_intent_id == payment_intent)) is not None:
        return False
    user_id = int(metadata["user_id"])
    user = db.get(User, user_id)
    if user is None:
        # Deleted the account between paying and the webhook — refund by hand (docs/RUNBOOK.md).
        logger.error("stripe payment %s: user %s no longer exists, refund manually", payment_intent, user_id)
        return False
    try:
        token_wallet.grant(
            db,
            user_id,
            product=metadata["product"],
            tokens=int(metadata["tokens"]),
            amount_eur_cents=session.get("amount_total"),
            granted_by="stripe",
            stripe_payment_intent_id=payment_intent,
        )
    except IntegrityError:
        # A parallel delivery of the same event got there first.
        db.rollback()
        return False
    logger.info("stripe payment %s: credited %s to user %s", payment_intent, metadata["product"], user_id)
    if on_credited is not None:
        on_credited(
            user.email,
            metadata["product"],
            int(metadata["tokens"]),
            session.get("amount_total"),
            payment_intent,
        )
    return True

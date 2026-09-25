import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.checkout import checkout_enabled_for
from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.models.user import User
from app.schemas.payments import CheckoutRead, CheckoutRequest, WebhookRead
from app.services import payments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/checkout", response_model=CheckoutRead)
def create_checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutRead:
    """Open a Stripe Checkout Session for a token package (ADR-0048), behind the STRIPE_CHECKOUT flag."""
    if not checkout_enabled_for(current_user.email):
        raise HTTPException(status_code=403, detail="Checkout is not available")
    try:
        url = payments.create_checkout_url(db, current_user, payload.product)
    except payments.CheckoutUnavailable as exc:
        logger.warning("checkout unavailable for user %s: %s", current_user.id, exc)
        raise HTTPException(status_code=502, detail="Checkout is currently unavailable") from exc
    return CheckoutRead(url=url)


async def _raw_body(request: Request) -> bytes:
    # The signature covers the exact bytes Stripe sent — never a re-serialized JSON body. A
    # dependency, so the handler itself can stay sync (its DB work runs in the threadpool rather
    # than blocking the event loop).
    return await request.body()


# Deliberately no auth dependency: Stripe calls this, and the Stripe-Signature header (checked
# against STRIPE_WEBHOOK_SECRET) is what authenticates it. Not gated on STRIPE_CHECKOUT — a session
# opened while the flag was on must still be credited after it's switched off.
@router.post("/webhook", response_model=WebhookRead)
def stripe_webhook(
    request: Request, payload: bytes = Depends(_raw_body), db: Session = Depends(get_db)
) -> WebhookRead:
    """Stripe's event callback: credits the tokens of a paid Checkout Session, exactly once."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook is not configured")
    try:
        event = payments.parse_webhook(payload, request.headers.get("stripe-signature"))
    except payments.InvalidWebhook as exc:
        logger.warning("stripe webhook rejected: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc
    if event.type not in payments.FULFILMENT_EVENTS:
        return WebhookRead(credited=False)
    return WebhookRead(credited=payments.fulfil_checkout_session(db, event.data.object.to_dict()))

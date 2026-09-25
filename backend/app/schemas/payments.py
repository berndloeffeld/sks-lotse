from typing import Annotated, Literal

from pydantic import BaseModel

from app.core.pricing import PACKAGE_PRODUCTS
from app.schemas.common import one_of


class CheckoutRequest(BaseModel):
    product: Annotated[str, one_of("product", PACKAGE_PRODUCTS)]
    # The learner's express consent that the tokens are provided at once and the right of withdrawal
    # lapses with it (§ 356 Abs. 5 BGB, AGB → Widerrufsrecht) — the request is refused without it.
    waive_withdrawal: Literal[True]


class CheckoutRead(BaseModel):
    """The Stripe-hosted payment page to send the browser to."""

    url: str

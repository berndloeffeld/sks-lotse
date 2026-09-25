from pydantic import BaseModel


class PublicTokenPackage(BaseModel):
    product: str
    tokens: int
    price_cents: int


class PublicPricing(BaseModel):
    """What the (unauthenticated) landing page / pricing page show (ADR-0043)."""

    ads_removed_price_cents: int
    signup_bonus_tokens: int
    packages: list[PublicTokenPackage]
    # STRIPE_CHECKOUT is "on" (ADR-0048): a logged-out visitor sees "log in to buy" instead of
    # "coming soon". The "admins" stage stays invisible here; the per-account answer is
    # UserRead.can_buy_tokens.
    checkout_enabled: bool

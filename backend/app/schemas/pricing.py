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
    # What a Lotsen-Check costs and how long an answer it takes, so the frontend states the same
    # numbers the backend enforces (services/token_wallet.py, GRADING_MAX_ANSWER_CHARS).
    catalog_check_tokens: int
    chart_check_tokens: int
    check_max_answer_chars: int

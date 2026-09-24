from pydantic import BaseModel


class PublicTokenPackage(BaseModel):
    product: str
    tokens: int
    price_cents: int


class PublicPricing(BaseModel):
    """What the (unauthenticated) landing page / in-app teaser show — no purchase flow yet (ADR-0043)."""

    ads_removed_price_cents: int
    signup_bonus_tokens: int
    packages: list[PublicTokenPackage]

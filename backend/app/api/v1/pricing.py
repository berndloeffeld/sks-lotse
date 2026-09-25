from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core import cache
from app.core import pricing as pricing_core
from app.core.checkout import checkout_open_to_everyone
from app.core.database import get_db
from app.schemas.pricing import PublicPricing, PublicTokenPackage

# Deliberately no auth dependency: the landing page (unauthenticated marketing) needs these
# numbers too, not just the logged-in in-app teaser. See CLAUDE.md → Auth & rate limiting for the
# short list of routes this joins as intentionally open. Still covered by the blanket per-IP rate
# limit on all of /api/v1 (app/main.py).
router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get("", response_model=PublicPricing)
def get_pricing(request: Request, db: Session = Depends(get_db)) -> PublicPricing:
    """Current token-package and ads-removal prices, and whether the packages can be bought (ADR-0048)."""

    def load() -> PublicPricing:
        return PublicPricing(
            ads_removed_price_cents=pricing_core.ads_removed_price_cents(db),
            signup_bonus_tokens=pricing_core.signup_bonus_tokens(db),
            packages=[
                PublicTokenPackage(product=p.product, tokens=p.tokens, price_cents=p.price_cents)
                for p in pricing_core.token_packages(db)
            ],
            checkout_enabled=checkout_open_to_everyone(),
        )

    return cache.get_or_set(
        request.app,
        pricing_core.PUBLIC_PRICING_CACHE_KEY,
        pricing_core.PUBLIC_PRICING_CACHE_TTL_SECONDS,
        load,
    )

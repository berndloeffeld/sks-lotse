from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core import cache
from app.core.checkout import checkout_open_to_everyone
from app.core.config import settings
from app.core.database import get_db
from app.schemas.pricing import PublicPricing, PublicTokenPackage
from app.services import pricing as pricing_service
from app.services import token_wallet

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
            ads_removed_price_cents=pricing_service.ads_removed_price_cents(db),
            signup_bonus_tokens=pricing_service.signup_bonus_tokens(db),
            packages=[
                PublicTokenPackage(product=p.product, tokens=p.tokens, price_cents=p.price_cents)
                for p in pricing_service.token_packages(db)
            ],
            checkout_enabled=checkout_open_to_everyone(),
            catalog_check_tokens=token_wallet.TOKENS_PER_ANSWER_CHECK,
            chart_check_tokens=token_wallet.TOKENS_PER_CHART_CHECK,
            check_max_answer_chars=settings.grading_max_answer_chars,
        )

    return cache.get_or_set(
        request.app,
        pricing_service.PUBLIC_PRICING_CACHE_KEY,
        pricing_service.PUBLIC_PRICING_CACHE_TTL_SECONDS,
        load,
    )

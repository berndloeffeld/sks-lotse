"""Reading and writing operator-tunable prices in `app_settings` (ADR-0043).

An `app_settings` row if the operator has set one, else the code default in app/domain/pricing.py
(the same resolution shape the now-removed weekly AI-check default used, ADR-0036/ADR-0044).
"""

from sqlalchemy.orm import Session

from app.domain import pricing as pricing_domain
from app.models.app_setting import AppSetting

# Read on every landing-page/upsell render but changed only rarely by the operator — a short TTL
# is simpler than explicit cache invalidation from the settings-update endpoint (CLAUDE.md → Data
# Layer Conventions) and bounds staleness to a minute.
PUBLIC_PRICING_CACHE_KEY = "pricing:public"
PUBLIC_PRICING_CACHE_TTL_SECONDS = 60


def _setting_int(db: Session, key: str, default: int) -> int:
    row = db.get(AppSetting, key)
    return int(row.value) if row is not None else default


def token_package(db: Session, product: str) -> pricing_domain.TokenPackage:
    default = pricing_domain.PACKAGE_DEFAULTS[product]
    price_key, amount_key = pricing_domain.package_keys(product)
    return pricing_domain.TokenPackage(
        product=product,
        tokens=_setting_int(db, amount_key, default.tokens),
        price_cents=_setting_int(db, price_key, default.price_cents),
    )


def token_packages(db: Session) -> list[pricing_domain.TokenPackage]:
    return [token_package(db, product) for product in pricing_domain.PACKAGE_PRODUCTS]


def ads_removed_price_cents(db: Session) -> int:
    return _setting_int(
        db, pricing_domain.ADS_REMOVED_PRICE_KEY, pricing_domain.DEFAULT_ADS_REMOVED_PRICE_CENTS
    )


def signup_bonus_tokens(db: Session) -> int:
    return _setting_int(
        db, pricing_domain.SIGNUP_BONUS_TOKENS_KEY, pricing_domain.DEFAULT_SIGNUP_BONUS_TOKENS
    )


def _set(db: Session, key: str, value: int) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=str(value)))
    else:
        row.value = str(value)


def set_prices(
    db: Session,
    *,
    price_ads_removed_cents: int,
    signup_bonus_tokens: int,
    packages: dict[str, pricing_domain.TokenPackage],
) -> None:
    """Replace every price/package setting at once (the settings page submits a full form)."""
    _set(db, pricing_domain.ADS_REMOVED_PRICE_KEY, price_ads_removed_cents)
    _set(db, pricing_domain.SIGNUP_BONUS_TOKENS_KEY, signup_bonus_tokens)
    for product, package in packages.items():
        price_key, amount_key = pricing_domain.package_keys(product)
        _set(db, price_key, package.price_cents)
        _set(db, amount_key, package.tokens)
    db.commit()

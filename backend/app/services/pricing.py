"""Writing operator-tunable prices into `app_settings` (ADR-0043)."""

from sqlalchemy.orm import Session

from app.core import pricing as pricing_core
from app.models.app_setting import AppSetting


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
    packages: dict[str, pricing_core.TokenPackage],
) -> None:
    """Replace every price/package setting at once (the settings page submits a full form)."""
    _set(db, pricing_core.ADS_REMOVED_PRICE_KEY, price_ads_removed_cents)
    _set(db, pricing_core.SIGNUP_BONUS_TOKENS_KEY, signup_bonus_tokens)
    for product, package in packages.items():
        price_key, amount_key = pricing_core.package_keys(product)
        _set(db, price_key, package.price_cents)
        _set(db, amount_key, package.tokens)
    db.commit()

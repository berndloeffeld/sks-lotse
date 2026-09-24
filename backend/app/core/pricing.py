"""Token-package and ads-removal prices (ADR-0043): operator-tunable via `/admin/settings`.

Same shape as `app/core/ai_quota.py`'s weekly default: an `app_settings` row if the operator has
set one, else the code default below. There is no per-user override — prices are the same for
everyone. A package's identifier (`tokens_s`/`tokens_m`/`tokens_l`/`tokens_xl`) doubles as a
`Purchase.product` value (app/models/purchase.py) — keep both in sync if a package is renamed.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting

ADS_REMOVED_PRICE_KEY = "price_ads_removed_cents"
DEFAULT_ADS_REMOVED_PRICE_CENTS = 500

SIGNUP_BONUS_TOKENS_KEY = "signup_bonus_tokens"
DEFAULT_SIGNUP_BONUS_TOKENS = 6

# Read on every landing-page/upsell render but changed only rarely by the operator — a short TTL
# is simpler than explicit cache invalidation from the settings-update endpoint (CLAUDE.md → Data
# Layer Conventions) and bounds staleness to a minute.
PUBLIC_PRICING_CACHE_KEY = "pricing:public"
PUBLIC_PRICING_CACHE_TTL_SECONDS = 60


@dataclass(frozen=True)
class TokenPackage:
    product: str  # matches Purchase.product
    tokens: int
    price_cents: int


_PACKAGE_DEFAULTS: dict[str, TokenPackage] = {
    "tokens_s": TokenPackage("tokens_s", 20, 299),
    "tokens_m": TokenPackage("tokens_m", 50, 599),
    "tokens_l": TokenPackage("tokens_l", 100, 999),
    "tokens_xl": TokenPackage("tokens_xl", 200, 1699),
}

# Display/read order — smallest to largest.
PACKAGE_PRODUCTS = ("tokens_s", "tokens_m", "tokens_l", "tokens_xl")


def package_keys(product: str) -> tuple[str, str]:
    """The (price, amount) `app_settings` keys for a package's product identifier."""
    return f"price_{product}_cents", f"{product}_amount"


def _setting_int(db: Session, key: str, default: int) -> int:
    row = db.get(AppSetting, key)
    return int(row.value) if row is not None else default


def token_package(db: Session, product: str) -> TokenPackage:
    default = _PACKAGE_DEFAULTS[product]
    price_key, amount_key = package_keys(product)
    return TokenPackage(
        product=product,
        tokens=_setting_int(db, amount_key, default.tokens),
        price_cents=_setting_int(db, price_key, default.price_cents),
    )


def token_packages(db: Session) -> list[TokenPackage]:
    return [token_package(db, product) for product in PACKAGE_PRODUCTS]


def ads_removed_price_cents(db: Session) -> int:
    return _setting_int(db, ADS_REMOVED_PRICE_KEY, DEFAULT_ADS_REMOVED_PRICE_CENTS)


def signup_bonus_tokens(db: Session) -> int:
    return _setting_int(db, SIGNUP_BONUS_TOKENS_KEY, DEFAULT_SIGNUP_BONUS_TOKENS)

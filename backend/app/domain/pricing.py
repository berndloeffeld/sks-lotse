"""Token-package and ads-removal prices (ADR-0043): the code defaults and `app_settings` keys.

The operator can override every value via `/admin/settings`; reading the effective price (an
`app_settings` row if set, else the default here) is `app/services/pricing.py`. There is no
per-user override — prices are the same for everyone. A package's identifier
(`tokens_s`/`tokens_m`/`tokens_l`/`tokens_xl`) doubles as a `Purchase.product` value
(app/models/purchase.py) — keep both in sync if a package is renamed.
"""

from dataclasses import dataclass

ADS_REMOVED_PRICE_KEY = "price_ads_removed_cents"
DEFAULT_ADS_REMOVED_PRICE_CENTS = 500

SIGNUP_BONUS_TOKENS_KEY = "signup_bonus_tokens"
DEFAULT_SIGNUP_BONUS_TOKENS = 6


@dataclass(frozen=True)
class TokenPackage:
    product: str  # matches Purchase.product
    tokens: int
    price_cents: int


PACKAGE_DEFAULTS: dict[str, TokenPackage] = {
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

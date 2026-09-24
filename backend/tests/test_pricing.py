from app.core import pricing as pricing_core
from app.services import pricing as pricing_service


def test_defaults_apply_when_nothing_is_configured(db_session):
    assert pricing_core.ads_removed_price_cents(db_session) == pricing_core.DEFAULT_ADS_REMOVED_PRICE_CENTS
    assert pricing_core.signup_bonus_tokens(db_session) == pricing_core.DEFAULT_SIGNUP_BONUS_TOKENS
    packages = pricing_core.token_packages(db_session)
    assert [p.product for p in packages] == list(pricing_core.PACKAGE_PRODUCTS)
    assert [(p.tokens, p.price_cents) for p in packages] == [(20, 299), (50, 599), (100, 999), (200, 1699)]


def test_set_prices_overrides_the_defaults(db_session):
    pricing_service.set_prices(
        db_session,
        price_ads_removed_cents=799,
        signup_bonus_tokens=3,
        packages={"tokens_s": pricing_core.TokenPackage("tokens_s", 15, 249)},
    )
    assert pricing_core.ads_removed_price_cents(db_session) == 799
    assert pricing_core.signup_bonus_tokens(db_session) == 3
    changed = pricing_core.token_package(db_session, "tokens_s")
    assert (changed.tokens, changed.price_cents) == (15, 249)
    # A package not passed to set_prices keeps its default.
    unchanged = pricing_core.token_package(db_session, "tokens_m")
    assert (unchanged.tokens, unchanged.price_cents) == (50, 599)


def test_set_prices_updates_an_existing_row_rather_than_duplicating_it(db_session):
    pricing_service.set_prices(db_session, price_ads_removed_cents=500, signup_bonus_tokens=6, packages={})
    pricing_service.set_prices(db_session, price_ads_removed_cents=700, signup_bonus_tokens=6, packages={})
    assert pricing_core.ads_removed_price_cents(db_session) == 700


def test_public_pricing_endpoint_reflects_the_configured_prices(client, db_session):
    pricing_service.set_prices(
        db_session,
        price_ads_removed_cents=799,
        signup_bonus_tokens=3,
        packages={"tokens_s": pricing_core.TokenPackage("tokens_s", 15, 249)},
    )
    response = client.get("/api/v1/pricing")
    assert response.status_code == 200
    body = response.json()
    assert body["ads_removed_price_cents"] == 799
    assert body["signup_bonus_tokens"] == 3
    assert body["packages"][0] == {"product": "tokens_s", "tokens": 15, "price_cents": 249}
    assert len(body["packages"]) == 4


def test_public_pricing_endpoint_needs_no_auth(client):
    assert client.get("/api/v1/pricing").status_code == 200

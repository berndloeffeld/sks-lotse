import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
import stripe
from sqlalchemy.exc import IntegrityError

from app.core import checkout
from app.core import pricing as pricing_core
from app.core.config import settings
from app.models.purchase import Purchase
from app.models.user import User
from app.services import payments
from app.services import pricing as pricing_service
from tests.helpers import FIXTURE_EMAIL, fixture_user, make_admin

WEBHOOK_SECRET = "whsec_test_secret"
WRONG_SECRET = "whsec_wrong"
PRODUCT_ID = "prod_test_s"


@pytest.fixture()
def stripe_configured(monkeypatch):
    monkeypatch.setattr(settings, "stripe_checkout", "on")
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "stripe_product_tokens_s", PRODUCT_ID)


class _FakeSessions:
    def __init__(self, url="https://checkout.stripe.com/c/pay/cs_test_1", error=None):
        self.url = url
        self.error = error
        self.params = None

    def create(self, params):
        self.params = params
        if self.error:
            raise self.error
        return SimpleNamespace(url=self.url)


@pytest.fixture()
def fake_stripe(monkeypatch):
    sessions = _FakeSessions()
    client = SimpleNamespace(v1=SimpleNamespace(checkout=SimpleNamespace(sessions=sessions)))
    monkeypatch.setattr(payments, "_client", lambda: client)
    return sessions


def _checkout(client, headers, product="tokens_s", waive=True):
    return client.post(
        "/api/v1/payments/checkout", json={"product": product, "waive_withdrawal": waive}, headers=headers
    )


# --- the feature flag -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("flag", "key", "admin", "expected"),
    [
        ("off", "sk_test", True, False),
        ("admins", "sk_test", False, False),
        ("admins", "sk_test", True, True),
        ("on", "sk_test", False, True),
        ("on", "", True, False),
        ("admins", "", True, False),
    ],
)
def test_checkout_enabled_for_follows_the_flag(monkeypatch, flag, key, admin, expected):
    monkeypatch.setattr(settings, "stripe_checkout", flag)
    monkeypatch.setattr(settings, "stripe_secret_key", key)
    monkeypatch.setattr(settings, "admin_emails", FIXTURE_EMAIL if admin else "")
    assert checkout.checkout_enabled_for(FIXTURE_EMAIL) is expected


@pytest.mark.parametrize(
    ("flag", "key", "expected"), [("on", "sk", True), ("admins", "sk", False), ("on", "", False)]
)
def test_checkout_open_to_everyone_only_when_on(monkeypatch, flag, key, expected):
    monkeypatch.setattr(settings, "stripe_checkout", flag)
    monkeypatch.setattr(settings, "stripe_secret_key", key)
    assert checkout.checkout_open_to_everyone() is expected


def test_stripe_product_id_maps_each_package(monkeypatch):
    for product in pricing_core.PACKAGE_PRODUCTS:
        monkeypatch.setattr(settings, f"stripe_product_{product}", f"prod_{product}")
    assert [checkout.stripe_product_id(p) for p in pricing_core.PACKAGE_PRODUCTS] == [
        "prod_tokens_s",
        "prod_tokens_m",
        "prod_tokens_l",
        "prod_tokens_xl",
    ]
    assert checkout.stripe_product_id("ads_removed") == ""


def test_me_reports_whether_the_account_can_buy(client, auth_headers, monkeypatch):
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["can_buy_tokens"] is False
    monkeypatch.setattr(settings, "stripe_checkout", "admins")
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    make_admin(monkeypatch)
    assert client.get("/api/v1/auth/me", headers=auth_headers).json()["can_buy_tokens"] is True


def test_public_pricing_reports_checkout_only_when_on(client, monkeypatch):
    assert client.get("/api/v1/pricing").json()["checkout_enabled"] is False
    monkeypatch.setattr(settings, "stripe_checkout", "on")
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    client.app.state.cache_entries = {}
    assert client.get("/api/v1/pricing").json()["checkout_enabled"] is True


# --- opening a checkout ---------------------------------------------------------------------------


def test_build_checkout_params_uses_the_checkout_studio_settings(db_session, auth_headers):
    user = fixture_user(db_session)
    package = pricing_core.TokenPackage("tokens_m", 50, 599)
    params = payments.build_checkout_params(user, package, "prod_m", "https://sks-lotse.de")
    assert params == {
        "ui_mode": "hosted_page",
        "billing_address_collection": "auto",
        "phone_number_collection": {"enabled": False},
        "automatic_tax": {"enabled": False},
        "allow_promotion_codes": False,
        "submit_type": "auto",
        "integration_identifier": "hosted_web_0001",
        "origin_context": "web",
        "mode": "payment",
        "line_items": [
            {"price_data": {"currency": "eur", "product": "prod_m", "unit_amount": 599}, "quantity": 1}
        ],
        "customer_email": FIXTURE_EMAIL,
        "client_reference_id": str(user.id),
        "metadata": {
            "user_id": str(user.id),
            "product": "tokens_m",
            "tokens": "50",
            "withdrawal_waiver": "accepted",
        },
        "success_url": "https://sks-lotse.de/pricing?checkout=success",
        "cancel_url": "https://sks-lotse.de/pricing?checkout=cancelled",
    }
    assert "payment_method_collection" not in params


def test_checkout_returns_the_stripe_url_with_the_configured_price(
    client, db_session, auth_headers, stripe_configured, fake_stripe
):
    pricing_service.set_prices(
        db_session,
        price_ads_removed_cents=500,
        signup_bonus_tokens=6,
        packages={"tokens_s": pricing_core.TokenPackage("tokens_s", 25, 349)},
    )
    response = _checkout(client, auth_headers)
    assert response.status_code == 200
    assert response.json() == {"url": fake_stripe.url}
    assert fake_stripe.params["line_items"][0]["price_data"] == {
        "currency": "eur",
        "product": PRODUCT_ID,
        "unit_amount": 349,
    }
    assert fake_stripe.params["metadata"]["tokens"] == "25"
    assert fake_stripe.params["success_url"].startswith(settings.cors_allowed_origins[0])


def test_checkout_is_refused_while_the_flag_is_off(
    client, auth_headers, stripe_configured, fake_stripe, monkeypatch
):
    monkeypatch.setattr(settings, "stripe_checkout", "off")
    response = _checkout(client, auth_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Checkout is not available"
    assert fake_stripe.params is None


def test_checkout_in_admins_stage_is_refused_for_a_learner(
    client, auth_headers, stripe_configured, fake_stripe, monkeypatch
):
    monkeypatch.setattr(settings, "stripe_checkout", "admins")
    assert _checkout(client, auth_headers).status_code == 403
    make_admin(monkeypatch)
    assert _checkout(client, auth_headers).status_code == 200


def test_checkout_needs_the_withdrawal_waiver(client, auth_headers, stripe_configured, fake_stripe):
    assert _checkout(client, auth_headers, waive=False).status_code == 422
    assert fake_stripe.params is None


def test_checkout_rejects_a_product_that_is_not_a_token_package(
    client, auth_headers, stripe_configured, fake_stripe
):
    assert _checkout(client, auth_headers, product="ads_removed").status_code == 422


def test_checkout_without_a_product_id_answers_502(
    client, auth_headers, stripe_configured, fake_stripe, monkeypatch
):
    monkeypatch.setattr(settings, "stripe_product_tokens_s", "")
    assert _checkout(client, auth_headers).status_code == 502
    assert fake_stripe.params is None


def test_checkout_answers_502_on_a_stripe_error(client, auth_headers, stripe_configured, fake_stripe, caplog):
    fake_stripe.error = stripe.APIConnectionError("network down")
    with caplog.at_level("WARNING"):
        response = _checkout(client, auth_headers)
    assert response.status_code == 502
    assert response.json()["detail"] == "Checkout is currently unavailable"
    assert "checkout unavailable for user 1:" in caplog.text
    assert "APIConnectionError" in caplog.text


def test_checkout_answers_502_when_stripe_returns_no_url(
    client, auth_headers, stripe_configured, fake_stripe
):
    fake_stripe.url = None
    assert _checkout(client, auth_headers).status_code == 502


def test_checkout_has_its_own_rate_limit(client, auth_headers, stripe_configured, fake_stripe, monkeypatch):
    for _ in range(settings.rate_limit_checkout_max_requests):
        assert _checkout(client, auth_headers).status_code == 200
    assert _checkout(client, auth_headers).status_code == 429


def test_the_stripe_client_carries_the_secret_key(monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    assert isinstance(payments._client(), stripe.StripeClient)


# --- the webhook ----------------------------------------------------------------------------------


def _session(user_id, *, payment_intent="pi_1", status="paid", product="tokens_s", tokens=20, amount=299):
    return {
        "id": "cs_test_1",
        "object": "checkout.session",
        "payment_status": status,
        "payment_intent": payment_intent,
        "amount_total": amount,
        "metadata": {"user_id": str(user_id), "product": product, "tokens": str(tokens)},
    }


def _event(session, event_type="checkout.session.completed"):
    return {"id": "evt_1", "object": "event", "type": event_type, "data": {"object": session}}


def _signed(payload: bytes, secret: str = WEBHOOK_SECRET) -> str:
    timestamp = int(time.time())
    signature = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


def _post_event(client, event, secret=WEBHOOK_SECRET):
    payload = json.dumps(event).encode()
    return client.post(
        "/api/v1/payments/webhook",
        content=payload,
        headers={"Stripe-Signature": _signed(payload, secret), "Content-Type": "application/json"},
    )


def test_webhook_credits_a_paid_session_exactly_once(client, db_session, auth_headers, stripe_configured):
    user = fixture_user(db_session)
    event = _event(_session(user.id))
    first = _post_event(client, event)
    assert first.status_code == 200
    assert first.json() == {"credited": True}
    # Stripe delivers at least once — a redelivery must not credit again.
    assert _post_event(client, event).json() == {"credited": False}
    db_session.refresh(user)
    assert user.token_balance == 20
    purchase = db_session.query(Purchase).one()
    assert (purchase.product, purchase.tokens_granted, purchase.amount_eur_cents) == ("tokens_s", 20, 299)
    assert (purchase.granted_by, purchase.stripe_payment_intent_id) == ("stripe", "pi_1")


def test_webhook_works_with_the_flag_off(client, db_session, auth_headers, stripe_configured, monkeypatch):
    monkeypatch.setattr(settings, "stripe_checkout", "off")
    user = fixture_user(db_session)
    assert _post_event(client, _event(_session(user.id))).json() == {"credited": True}


def test_webhook_skips_an_unpaid_session_until_the_async_payment_succeeds(
    client, db_session, auth_headers, stripe_configured
):
    user = fixture_user(db_session)
    assert _post_event(client, _event(_session(user.id, status="unpaid"))).json() == {"credited": False}
    succeeded = _event(_session(user.id), "checkout.session.async_payment_succeeded")
    assert _post_event(client, succeeded).json() == {"credited": True}
    db_session.refresh(user)
    assert user.token_balance == 20


def test_webhook_ignores_other_events(client, db_session, auth_headers, stripe_configured):
    user = fixture_user(db_session)
    response = _post_event(client, _event(_session(user.id), "checkout.session.expired"))
    assert response.json() == {"credited": False}
    assert db_session.query(Purchase).count() == 0


def test_webhook_rejects_a_bad_signature(client, db_session, auth_headers, stripe_configured):
    user = fixture_user(db_session)
    response = _post_event(client, _event(_session(user.id)), secret=WRONG_SECRET)
    assert response.status_code == 400
    assert db_session.query(Purchase).count() == 0


def test_webhook_rejects_a_missing_signature(client, stripe_configured):
    response = client.post("/api/v1/payments/webhook", content=b"{}")
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid webhook signature"


def test_webhook_answers_503_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    response = client.post("/api/v1/payments/webhook", content=b"{}")
    assert response.status_code == 503
    assert response.json()["detail"] == "Webhook is not configured"


def test_fulfil_skips_a_deleted_account(db_session):
    assert payments.fulfil_checkout_session(db_session, _session(4711)) is False
    assert db_session.query(Purchase).count() == 0


@pytest.mark.parametrize(
    "session",
    [
        {"payment_status": "paid", "payment_intent": None, "metadata": {"user_id": "1"}},
        {"payment_status": "paid", "payment_intent": "pi_1", "metadata": None},
        {"payment_status": "paid", "payment_intent": "pi_1", "metadata": {}},
    ],
)
def test_fulfil_skips_a_session_without_payment_intent_or_user(db_session, session):
    assert payments.fulfil_checkout_session(db_session, session) is False


def test_fulfil_treats_a_parallel_delivery_as_done(db_session, auth_headers, monkeypatch):
    user = fixture_user(db_session)

    def racing_grant(*args, **kwargs):
        raise IntegrityError("insert", {}, Exception("duplicate key"))

    monkeypatch.setattr(payments.token_wallet, "grant", racing_grant)
    assert payments.fulfil_checkout_session(db_session, _session(user.id)) is False
    assert db_session.get(User, user.id).token_balance == 0

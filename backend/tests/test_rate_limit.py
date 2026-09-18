from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core import rate_limit
from app.core.rate_limit import RateLimitMiddleware


async def _endpoint(request):
    return PlainTextResponse("ok")


def _make_app(**middleware_kwargs):
    app = Starlette(
        routes=[
            Route("/limited", _endpoint),
            Route("/api/v1/other", _endpoint),
            Route("/api/v1/another", _endpoint),
            Route("/unscoped", _endpoint),
        ]
    )
    app.add_middleware(RateLimitMiddleware, **middleware_kwargs)
    return app


def test_exact_rule_overrides_default():
    app = _make_app(rules={"/limited": (2, 60)}, default_rule=(5, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/limited").status_code == 200
    assert client.get("/limited").status_code == 200
    assert client.get("/limited").status_code == 429


def test_default_rule_applies_within_scope_prefix():
    app = _make_app(default_rule=(2, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/api/v1/other").status_code == 200
    assert client.get("/api/v1/other").status_code == 200
    assert client.get("/api/v1/other").status_code == 429


def test_path_outside_scope_prefix_is_not_limited():
    app = _make_app(default_rule=(1, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/unscoped").status_code == 200
    assert client.get("/unscoped").status_code == 200


def test_no_rules_configured_means_unlimited():
    app = _make_app()
    client = TestClient(app)

    for _ in range(5):
        assert client.get("/limited").status_code == 200


_CF = ("cf-connecting-ip", "true-client-ip")


def test_trusted_header_separates_clients():
    # Behind Render/Cloudflare, every request arrives from a proxy socket —
    # the trusted header is what tells two clients apart.
    app = _make_app(default_rule=(1, 60), scope_prefix="/api/v1", trusted_client_ip_headers=_CF)
    client = TestClient(app)

    assert client.get("/api/v1/other", headers={"cf-connecting-ip": "9.9.9.9"}).status_code == 200
    assert client.get("/api/v1/other", headers={"cf-connecting-ip": "8.8.8.8"}).status_code == 200
    assert client.get("/api/v1/other", headers={"cf-connecting-ip": "9.9.9.9"}).status_code == 429


def test_trusted_headers_checked_in_order_with_fallback():
    app = _make_app(default_rule=(1, 60), scope_prefix="/api/v1", trusted_client_ip_headers=_CF)
    client = TestClient(app)

    assert client.get("/api/v1/other", headers={"true-client-ip": "7.7.7.7"}).status_code == 200
    assert (
        client.get(
            "/api/v1/other", headers={"cf-connecting-ip": "7.7.7.7", "true-client-ip": "6.6.6.6"}
        ).status_code
        == 429
    )


def test_client_ip_headers_ignored_unless_trusted():
    # Not on Render: nothing in front overwrites these headers, so a client
    # must not be able to mint a fresh bucket by sending them itself.
    app = _make_app(default_rule=(1, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/api/v1/other", headers={"cf-connecting-ip": "1.2.3.4"}).status_code == 200
    assert client.get("/api/v1/other", headers={"cf-connecting-ip": "5.6.7.8"}).status_code == 429


def test_x_forwarded_for_is_never_used():
    # Its last entry is a shared proxy hop in production (every caller would
    # share one bucket); its other entries are client-controllable.
    app = _make_app(default_rule=(1, 60), scope_prefix="/api/v1", trusted_client_ip_headers=_CF)
    client = TestClient(app)

    assert client.get("/api/v1/other", headers={"x-forwarded-for": "1.2.3.4, 10.0.0.1"}).status_code == 200
    assert client.get("/api/v1/other", headers={"x-forwarded-for": "5.6.7.8, 10.0.0.2"}).status_code == 429


def test_default_rule_is_one_bucket_across_paths_in_scope():
    # The blanket cap is per IP across the whole scope, not per path — else
    # every distinct path (e.g. /questions/1, /questions/2) gets its own quota.
    app = _make_app(default_rule=(2, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/api/v1/other").status_code == 200
    assert client.get("/api/v1/another").status_code == 200
    assert client.get("/api/v1/other").status_code == 429


def test_exact_rule_has_its_own_bucket_independent_of_default():
    app = _make_app(rules={"/api/v1/other": (1, 60)}, default_rule=(5, 60), scope_prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/api/v1/other").status_code == 200
    assert client.get("/api/v1/other").status_code == 429
    assert client.get("/api/v1/another").status_code == 200


def test_check_and_record_allows_up_to_the_limit_then_blocks():
    # Used directly by request_email_change (see app/api/v1/auth.py) for a
    # second, per-authenticated-user cap alongside the IP-based middleware
    # above — same primitive, different key.
    app = Starlette()
    assert rate_limit.check_and_record(app, "bucket", "key", 2, 60) is True
    assert rate_limit.check_and_record(app, "bucket", "key", 2, 60) is True
    assert rate_limit.check_and_record(app, "bucket", "key", 2, 60) is False


def test_check_and_record_window_slides(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock[0])
    app = Starlette()

    assert rate_limit.check_and_record(app, "bucket", "key", 1, 60) is True
    assert rate_limit.check_and_record(app, "bucket", "key", 1, 60) is False

    clock[0] += 61
    assert rate_limit.check_and_record(app, "bucket", "key", 1, 60) is True


def test_idle_keys_are_swept(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(rate_limit.cache.time, "monotonic", lambda: clock[0])
    app = _make_app(default_rule=(5, 60), scope_prefix="/api/v1", trusted_client_ip_headers=_CF)
    client = TestClient(app)

    client.get("/api/v1/other", headers={"cf-connecting-ip": "1.1.1.1"})
    assert ("/api/v1", "1.1.1.1") in app.state.rate_limit_hits

    clock[0] += 61 + rate_limit._SWEEP_INTERVAL_SECONDS
    client.get("/api/v1/other", headers={"cf-connecting-ip": "2.2.2.2"})

    assert ("/api/v1", "1.1.1.1") not in app.state.rate_limit_hits
    assert ("/api/v1", "2.2.2.2") in app.state.rate_limit_hits


def test_sweep_keeps_route_level_keys_with_a_longer_window_than_the_middleware(monkeypatch):
    # check_and_record is also called from route handlers (e.g. the per-user
    # email-change cap) with windows the middleware's own rules don't know
    # about — the sweep must honor each key's own window.
    clock = [1000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(rate_limit.cache.time, "monotonic", lambda: clock[0])
    app = _make_app(default_rule=(5, 60), scope_prefix="/api/v1", trusted_client_ip_headers=_CF)
    client = TestClient(app)

    assert rate_limit.check_and_record(app, "per-user", "42", 1, 3600) is True

    clock[0] += 61 + rate_limit._SWEEP_INTERVAL_SECONDS
    client.get("/api/v1/other", headers={"cf-connecting-ip": "1.1.1.1"})

    assert ("per-user", "42") in app.state.rate_limit_hits
    assert rate_limit.check_and_record(app, "per-user", "42", 1, 3600) is False

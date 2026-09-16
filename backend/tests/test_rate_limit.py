from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core.rate_limit import RateLimitMiddleware


async def _endpoint(request):
    return PlainTextResponse("ok")


def _make_app(**middleware_kwargs):
    app = Starlette(
        routes=[
            Route("/limited", _endpoint),
            Route("/api/v1/other", _endpoint),
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

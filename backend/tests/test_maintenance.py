from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core.maintenance import MAINTENANCE_HEADER, MaintenanceModeMiddleware
from app.main import app as main_app


async def _endpoint(request):
    return PlainTextResponse("ok")


def _make_app(**middleware_kwargs):
    app = Starlette(
        routes=[
            Route("/health", _endpoint),
            Route("/api/v1/questions", _endpoint),
        ]
    )
    app.add_middleware(MaintenanceModeMiddleware, **middleware_kwargs)
    return app


def test_disabled_is_a_passthrough():
    client = TestClient(_make_app(enabled=False))

    assert client.get("/api/v1/questions").status_code == 200


def test_enabled_blocks_scoped_paths():
    client = TestClient(_make_app(enabled=True))

    response = client.get("/api/v1/questions")

    assert response.status_code == 503
    assert response.headers[MAINTENANCE_HEADER] == "1"
    assert response.json() == {"detail": "SKS Lotse befindet sich aktuell im Wartungsmodus."}


def test_enabled_still_answers_health_normally():
    client = TestClient(_make_app(enabled=True))

    response = client.get("/health")

    assert response.status_code == 200
    assert MAINTENANCE_HEADER not in response.headers


def test_enabled_only_blocks_paths_under_a_custom_scope_prefix():
    client = TestClient(_make_app(enabled=True, scope_prefix="/other"))

    assert client.get("/api/v1/questions").status_code == 200


def test_main_app_answers_maintenance_before_the_rate_limiter_counts_the_request():
    # The real app's middleware stack (app/main.py), only with maintenance mode switched on — the
    # flag is read once at import, so the stack is rebuilt rather than the setting patched.
    middleware = [
        Middleware(m.cls, *m.args, **{**m.kwargs, "enabled": True})
        if m.cls is MaintenanceModeMiddleware
        else m
        for m in main_app.user_middleware
    ]
    app = Starlette(routes=[Route("/api/v1/questions", _endpoint)], middleware=middleware)
    client = TestClient(app)

    assert client.get("/api/v1/questions").status_code == 503
    assert not getattr(app.state, "rate_limit_hits", {})

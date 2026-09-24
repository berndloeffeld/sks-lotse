# CORSMiddleware reads settings.cors_allowed_origins once, when app.main is
# imported (like _docs_kwargs()) — not per-request — so these tests exercise
# whatever origins are configured for the process's actual ENVIRONMENT
# (development, in CI and local test runs) rather than toggling it live.

import pytest


def test_allowed_origin_gets_cors_header(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_disallowed_origin_gets_no_cors_header(client):
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_maintenance_header_is_exposed_cross_origin(client):
    # Browsers hide all but a handful of "simple" response headers from
    # cross-origin JS unless the server lists them in Access-Control-Expose-
    # Headers — without it, frontend/src/api/client.ts would never see
    # X-Maintenance-Mode (app/core/maintenance.py) even though curl/the
    # network tab shows it fine.
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert "x-maintenance-mode" in response.headers["access-control-expose-headers"].lower()


def test_allowed_origin_gets_credentials_header(client):
    # Required for the browser to send/receive the session cookie
    # (ADR-0012) on a cross-origin request, e.g. the Vite dev server.
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-credentials"] == "true"


# One preflight per method the frontend sends cross-origin — see app/main.py's CORSMiddleware
# allow_methods.
@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/api/v1/questions", "GET"),
        ("/api/v1/auth/me", "PATCH"),  # exam variant, profile
        ("/api/v1/admin/users/1", "DELETE"),  # GDPR account deletion
        ("/api/v1/progress/focus/navigation/seekarten", "PUT"),  # Fokus star on /learn
        ("/api/v1/auth/otp/request", "POST"),  # login
    ],
)
def test_preflight_allows_the_method(client, path, method):
    response = client.options(
        path, headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": method}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

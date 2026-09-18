# CORSMiddleware reads settings.cors_allowed_origins once, when app.main is
# imported (like _docs_kwargs()) — not per-request — so these tests exercise
# whatever origins are configured for the process's actual ENVIRONMENT
# (development, in CI and local test runs) rather than toggling it live.


def test_allowed_origin_gets_cors_header(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_disallowed_origin_gets_no_cors_header(client):
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_allowed_origin_gets_credentials_header(client):
    # Required for the browser to send/receive the session cookie
    # (ADR-0012) on a cross-origin request, e.g. the Vite dev server.
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-credentials"] == "true"


def test_preflight_allows_configured_origin(client):
    response = client.options(
        "/api/v1/questions",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_preflight_allows_patch(client):
    # PATCH /auth/me (exam_variant selector) needs this — see app/main.py's
    # CORSMiddleware allow_methods.
    response = client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

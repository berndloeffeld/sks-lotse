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


def test_preflight_allows_delete(client):
    # DELETE /admin/users/{id} (GDPR account deletion) needs this — see
    # app/main.py's CORSMiddleware allow_methods.
    response = client.options(
        "/api/v1/admin/users/1",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "DELETE",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_preflight_allows_put(client):
    # PUT /progress/focus/{subject}/{topic} (Fokus star on /learn) needs this —
    # see app/main.py's CORSMiddleware allow_methods.
    response = client.options(
        "/api/v1/progress/focus/navigation/seekarten",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PUT",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

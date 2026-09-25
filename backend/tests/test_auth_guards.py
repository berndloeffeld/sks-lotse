"""Every /api/v1 route is guarded: 401 without a session, and 403 for a non-admin under /admin.

The routes come from the OpenAPI schema, so a new one is covered the moment it exists — nobody has
to remember to write its guard test. How the guard itself behaves (garbage or revoked tokens, the
cookie, missing claims) is tested in test_auth.py.
"""

import re

import pytest

from app.main import app

# The only routes open without a session (CLAUDE.md → Auth & rate limiting). /health is outside
# /api/v1 and the dev-only OTP peek isn't in the schema (include_in_schema=False).
PUBLIC = {
    ("POST", "/api/v1/auth/otp/request"),
    ("POST", "/api/v1/auth/otp/verify"),
    ("GET", "/api/v1/pricing"),
    # Stripe's event callback — authenticated by its Stripe-Signature header instead (ADR-0048).
    ("POST", "/api/v1/payments/webhook"),
}

OPERATIONS = sorted(
    (method.upper(), path)
    for path, item in app.openapi()["paths"].items()
    for method in item
    if path.startswith("/api/v1")
)
GUARDED = [operation for operation in OPERATIONS if operation not in PUBLIC]
ADMIN = [operation for operation in GUARDED if operation[1].startswith("/api/v1/admin")]


def _concrete(path: str) -> str:
    return re.sub(r"\{[^/]+\}", "1", path)


def test_the_public_routes_still_exist():
    # Otherwise a removed or renamed public route would leave a stale exemption behind.
    assert set(OPERATIONS) >= PUBLIC


@pytest.mark.parametrize(("method", "path"), GUARDED)
def test_route_rejects_a_request_without_a_session(client, method, path):
    assert client.request(method, _concrete(path)).status_code == 401


@pytest.mark.parametrize(("method", "path"), ADMIN)
def test_admin_route_rejects_a_learner(client, auth_headers, method, path):
    assert client.request(method, _concrete(path), headers=auth_headers).status_code == 403

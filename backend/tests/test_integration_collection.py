"""Keeps postman/integration-tests.postman_collection.json in step with the API.

That collection is hand-written (unlike sks-lotse.postman_collection.json, which is generated from
the OpenAPI schema and freshness-checked in CI), so nothing else notices when an endpoint is added,
renamed or removed. These checks are the tripwire: they fail with a message saying what to add.
They only check that every route is *exercised* and the collection's own invariants hold — what each
request asserts is up to the collection.
"""

import json
import re
from pathlib import Path

from app.main import app

COLLECTION = Path(__file__).resolve().parents[2] / "postman" / "integration-tests.postman_collection.json"

# Served by FastAPI itself in development (see _docs_kwargs in app/main.py), not part of the API.
_FRAMEWORK_PATHS = {"/docs", "/openapi.json", "/redoc"}
# Routes declared with include_in_schema=False never show up in the OpenAPI schema the coverage check
# is derived from, so they are listed here to still count as real (see ADR-0011 for this one).
_UNDOCUMENTED_ROUTES = {("GET", "/api/v1/auth/otp/_dev-peek")}

Routes = dict[tuple[str, str], re.Pattern[str]]


def _requests(items: list[dict] | None = None) -> list[dict]:
    items = json.loads(COLLECTION.read_text())["item"] if items is None else items
    found: list[dict] = []
    for entry in items:
        if "item" in entry:
            found += _requests(entry["item"])
        else:
            found.append(entry)
    return found


def _method(request_item: dict) -> str:
    return request_item["request"]["method"]


def _path_of(request_item: dict) -> str:
    # url["path"] holds the segments after {{baseUrl}}; the query string is kept separately.
    return "/" + "/".join(request_item["request"]["url"]["path"])


def _routes() -> Routes:
    # Read from the OpenAPI schema rather than app.routes: routers included via include_router are not
    # flat APIRoute entries there. app.openapi() works even where openapi_url is disabled (production).
    operations = {
        (method.upper(), path)
        for path, item in app.openapi()["paths"].items()
        for method in item
        if path.startswith("/api/v1") or path == "/health"
    } | _UNDOCUMENTED_ROUTES
    return {
        (method, path): re.compile("^" + re.sub(r"\{[^/]+\}", "[^/]+", path) + "$")
        for method, path in operations
    }


def _matching_route(method: str, path: str, routes: Routes) -> tuple[str, str] | None:
    """The most specific route a concrete request path belongs to (a literal beats a {param})."""
    # A collection path such as /api/v1/admin/users/{{victimId}} still matches `[^/]+`.
    candidates = [key for key, pattern in routes.items() if key[0] == method and pattern.match(path)]
    return min(candidates, key=lambda key: key[1].count("{"), default=None)


def test_every_route_is_exercised_by_the_integration_collection():
    routes = _routes()
    covered = {
        match
        for item in _requests()
        if (match := _matching_route(_method(item), _path_of(item), routes)) is not None
    }
    missing = sorted(f"{method} {path}" for method, path in set(routes) - covered)
    assert not missing, (
        "No request in postman/integration-tests.postman_collection.json exercises: "
        + ", ".join(missing)
        + ". Add requests (with pm.test assertions) by hand — see CLAUDE.md → Integration Tests."
    )


def test_every_integration_request_targets_a_real_route():
    routes = _routes()
    stale = sorted(
        f"{item['name']!r} ({_method(item)} {_path_of(item)})"
        for item in _requests()
        if _method(item) != "OPTIONS"  # CORS preflights are answered by middleware, not a route
        and _path_of(item) not in _FRAMEWORK_PATHS
        and _matching_route(_method(item), _path_of(item), routes) is None
    )
    assert not stale, f"Requests pointing at routes that no longer exist — update or remove: {stale}"


def test_every_integration_request_asserts_something():
    silent = sorted(
        item["name"]
        for item in _requests()
        if not any(
            event["listen"] == "test" and any("pm.test(" in line for line in event["script"]["exec"])
            for event in item.get("event", [])
        )
    )
    assert not silent, f"Requests without a single pm.test assertion: {silent}"


def test_bearer_and_guard_requests_disable_the_cookie_jar():
    # Newman keeps a cookie jar, and get_current_user reads the session cookie before any Authorization
    # header — so a request meant to authenticate via Bearer, or to be rejected for lack of credentials,
    # would silently be authenticated by the cookie. The collection description spells this out.
    leaky = sorted(
        item["name"]
        for item in _requests()
        if "session cookie" not in item["name"]
        and not item.get("protocolProfileBehavior", {}).get("disableCookies")
        and (
            any(h["key"] == "Authorization" for h in item["request"]["header"]) or "rejected" in item["name"]
        )
    )
    assert not leaky, f"Set protocolProfileBehavior.disableCookies on: {leaky}"

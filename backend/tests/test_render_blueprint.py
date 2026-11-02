"""The static site's block in render.yaml (ADR-0015)."""

from tests import render_blueprint


def test_the_frontend_does_not_proxy_the_api():
    # A rewrite of /api/* to the backend hides the caller's IP from the per-IP rate limit: behind
    # Render's rewrite the requests arrive from changing CDN addresses (measured 2026-10-24, ADR-0069).
    rewrites = render_blueprint.rewrites("sks-lotse-frontend")
    assert not any(source.startswith("/api") for source, _ in rewrites)

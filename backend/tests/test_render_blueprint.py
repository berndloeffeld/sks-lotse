"""SBF Lotse's static site in render.yaml (ADR-0067), next to SKS Lotse's."""

from tests import render_blueprint

SKS, SBF = "sks-lotse-frontend", "sbf-lotse-frontend"

# The SBF site's prerendered pages besides "/" (sbfPublicPages in frontend/src/sbf/publicPages.ts).
SBF_STATIC_PAGES = {"/faq", "/imprint", "/privacy"}


def test_both_sites_build_from_the_same_frontend_as_their_own_site():
    for name, site in ((SKS, "sks"), (SBF, "sbf")):
        service = render_blueprint.service(name)
        assert service["rootDir"] == "frontend"
        assert service["buildCommand"] == "npm ci && npm run build"
        assert render_blueprint.env(name)["VITE_SITE"]["value"] == site


def test_the_sbf_flag_is_set_for_the_sbf_build_only():
    # vite.config.ts fails a build that sets VITE_SBF with VITE_SITE=sks; quoted in render.yaml, since
    # an unquoted off/on would reach the build as a YAML boolean.
    assert render_blueprint.env(SBF)["VITE_SBF"]["value"] in ("off", "on")
    assert "VITE_SBF" not in render_blueprint.env(SKS)


def test_the_sbf_build_knows_no_api():
    # No account on SBF Lotse yet: no API origin for the build, and none the browser may connect to.
    assert "VITE_API_BASE_URL" not in render_blueprint.env(SBF)
    sbf = render_blueprint.csp_sources(SBF, "connect-src")
    assert sbf == ["'self'", "https://cloud.umami.is", "https://gateway.umami.is"]
    sks = render_blueprint.csp_sources(SKS, "connect-src")
    assert sks == ["'self'", "https://api.sks-lotse.de", "https://cloud.umami.is", "https://gateway.umami.is"]


def test_the_sbf_umami_id_is_set_in_the_dashboard():
    umami = render_blueprint.env(SBF)["VITE_UMAMI_WEBSITE_ID"]
    assert umami == {"key": "VITE_UMAMI_WEBSITE_ID", "sync": False}


def test_render_yaml_rewrites_every_sbf_page_to_its_file():
    # As for SKS Lotse (test_catalog_export.py, ADR-0057): every prerendered page its own rewrite,
    # ahead of the SPA fallback.
    rewrites = render_blueprint.rewrites(SBF)

    assert rewrites[-1] == ("/*", "/app.html")
    pages = dict(rewrites[:-1])
    assert all(destination == f"{source}.html" for source, destination in pages.items())
    # The /navigation pages are tied to VITE_SBF in test_sbf_navigation_export.py.
    assert {source for source in pages if not source.startswith("/navigation")} == SBF_STATIC_PAGES


def test_no_site_proxies_the_api():
    # A rewrite of /api/* to the backend hides the caller's IP from the per-IP rate limit: behind
    # Render's rewrite the requests arrive from changing CDN addresses (measured 2026-10-24, ADR-0069).
    for name in (SKS, SBF):
        assert not any(source.startswith("/api") for source, _ in render_blueprint.rewrites(name))

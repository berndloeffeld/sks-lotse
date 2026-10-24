"""Which of the two sites a request comes from: SKS Lotse or SBF Lotse (ADR-0070).

One backend serves both, under api.sks-lotse.de and api.sbf-lotse.de. What a request says about its
site decides only where mails and Stripe send the learner back to and whose brand they carry; the
account, its balance and its data are the same on both.
"""

from dataclasses import dataclass
from typing import Literal, get_args

from starlette.requests import HTTPConnection

from app.core.config import settings

Site = Literal["sks", "sbf"]
SITES: tuple[Site, ...] = get_args(Site)
DEFAULT_SITE: Site = "sks"

# The backend's custom domain for SBF Lotse: same-site with sbf-lotse.de, so the session cookie
# stays first-party there (ADR-0070).
SBF_API_HOST = "api.sbf-lotse.de"


@dataclass(frozen=True)
class SiteBrand:
    # As the wordmark and the mails say it.
    name: str
    # The mail footer's second part.
    tagline: str
    # Where a mail's "Weiterlernen" button leads, on the site's own origin.
    learn_path: str


BRANDS: dict[Site, SiteBrand] = {
    "sks": SiteBrand(name="SKS Lotse", tagline="Lernen für die SKS-Theorieprüfung", learn_path="/learn"),
    "sbf": SiteBrand(
        name="SBF Lotse", tagline="Lernen für den Sportbootführerschein See", learn_path="/navigation"
    ),
}


def as_site(value: object) -> Site:
    """`value` if it names a site, otherwise the default — for data from outside, like Stripe metadata."""
    return value if value in SITES else DEFAULT_SITE


def resolve_site(connection: HTTPConnection) -> Site:
    """The site a request comes from: its `Origin` if allowlisted, else its API host, else SKS Lotse.

    The browser sets `Origin` on every cross-origin call of the SPA, and a page can't fake it. A
    request without one (Postman, the login link's mail scanner, curl) falls back to the host it
    was sent to, and anything else to SKS Lotse — what every request got before there were two.
    """
    origin = connection.headers.get("origin")
    for site in SITES:
        if origin in settings.site_origins[site]:
            return site
    host = connection.headers.get("host", "").split(":", 1)[0].lower()
    return "sbf" if host == SBF_API_HOST else DEFAULT_SITE


def base_url(site: Site) -> str:
    """The site's canonical frontend origin, which mail links and Stripe's return URLs are built on."""
    return settings.site_origins[site][0]


def from_address(site: Site) -> str:
    return settings.email_from_address_sbf if site == "sbf" else settings.email_from_address

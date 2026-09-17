"""Redirects the secondary/defensive domains to the canonical one.

Avoids paying for IONOS's SSL-enabled domain forwarding (~8 EUR/month per
domain, 12-month minimum) by handling the redirect ourselves — the secondary
domains are added as Render Custom Domains (free automatic Let's Encrypt
certs) and just need something to bounce them to sks-lotse.de.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse

CANONICAL_DOMAIN = "sks-lotse.de"

SECONDARY_HOSTS = {
    "sks-lotse.com",
    "www.sks-lotse.com",
    # sks-lotse.global and sks-lotse.store are purchased but not wired up
    # (no DNS/Render Custom Domain) — not used for now, add here once they are.
}


class RedirectSecondaryDomainsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # /health is Render's own reachability check (see app/main.py) — it must
        # always answer directly no matter which hostname the check arrives on,
        # or a domain redirect here can make Render treat a healthy deploy as down.
        if request.url.path == "/health":
            return await call_next(request)
        host = request.headers.get("host", "").split(":")[0]
        if host in SECONDARY_HOSTS:
            target = f"https://{CANONICAL_DOMAIN}{request.url.path}"
            if request.url.query:
                target += f"?{request.url.query}"
            return RedirectResponse(url=target, status_code=301)
        return await call_next(request)

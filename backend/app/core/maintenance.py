"""Manual maintenance-mode kill switch (docs/RUNBOOK.md → Maintenance mode).

One env var, MAINTENANCE_MODE, flipped only from outside the running app — the
Render dashboard, or the maintenance-mode GitHub Action — never via /admin,
which may itself be affected by the malfunction that prompted this. No live
reload (app/core/config.py): a flip always takes a redeploy.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.site import BRANDS, resolve_site

MAINTENANCE_HEADER = "X-Maintenance-Mode"


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        # /health is outside /api/v1 and must always answer directly —
        # Render's own reachability check hits it regardless of maintenance mode.
        if not self.enabled or not request.url.path.startswith("/api/v1"):
            return await call_next(request)
        return JSONResponse(
            # The brand of the site the request came from (ADR-0070): one switch covers both.
            {"detail": f"{BRANDS[resolve_site(request)].name} befindet sich aktuell im Wartungsmodus."},
            status_code=503,
            headers={MAINTENANCE_HEADER: "1"},
        )

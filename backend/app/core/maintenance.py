"""Manual maintenance-mode kill switch (docs/RUNBOOK.md → Maintenance mode).

One env var, MAINTENANCE_MODE, flipped only from outside the running app — the
Render dashboard, or the maintenance-mode GitHub Action — never via /admin,
which may itself be affected by the malfunction that prompted this. No live
reload (app/core/config.py): a flip always takes a redeploy.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAINTENANCE_HEADER = "X-Maintenance-Mode"


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool, scope_prefix: str = "/api/v1"):
        super().__init__(app)
        self.enabled = enabled
        self.scope_prefix = scope_prefix

    async def dispatch(self, request: Request, call_next):
        # /health is outside scope_prefix and must always answer directly —
        # Render's own reachability check hits it regardless of maintenance mode.
        if not self.enabled or not request.url.path.startswith(self.scope_prefix):
            return await call_next(request)
        return JSONResponse(
            {"detail": "SKS Lotse befindet sich aktuell im Wartungsmodus."},
            status_code=503,
            headers={MAINTENANCE_HEADER: "1"},
        )

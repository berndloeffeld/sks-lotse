import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.api.v1 import router as api_v1_router
from app.core.canonical_domain import RedirectSecondaryDomainsMiddleware
from app.core.config import settings
from app.core.database import get_session_factory
from app.core.log_config import RequestIdMiddleware, configure_logging
from app.core.maintenance import MAINTENANCE_HEADER, MaintenanceModeMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware

configure_logging(settings.log_level, settings.log_format)
logger = logging.getLogger(__name__)


def _docs_kwargs() -> dict:
    # Swagger UI/ReDoc/the raw OpenAPI schema are dev/staging conveniences,
    # not something to expose on the public production API. Gated on the same
    # opt-in allowlist as the dev-only OTP peek endpoint, so both fail closed.
    if not settings.exposes_dev_tooling:
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {}


app = FastAPI(title="SKS Lotse API", **_docs_kwargs())
app.add_middleware(RedirectSecondaryDomainsMiddleware)
# Ahead of the rate limiter, so a request blocked here never burns a rate-limit
# counter during an incident. Still inside CORSMiddleware/RequestIdMiddleware
# below, so its 503 gets CORS headers and a request id like any other response.
app.add_middleware(MaintenanceModeMiddleware, enabled=settings.maintenance_mode)
app.add_middleware(
    RateLimitMiddleware,
    # OTP requests get their own tighter cap (bounds cost/spam per IP,
    # independent of the general cap below).
    rules={
        "/api/v1/auth/otp/request": (
            settings.rate_limit_otp_max_requests,
            settings.rate_limit_otp_window_seconds,
        ),
        # Bounds guess-spraying across many accounts' codes from one IP (each code alone
        # already allows only otp_max_attempts guesses, see app/api/v1/auth.py).
        "/api/v1/auth/otp/verify": (
            settings.rate_limit_otp_verify_max_requests,
            settings.rate_limit_otp_verify_window_seconds,
        ),
        # Same tightness as OTP login requests. A second, per-authenticated-user
        # cap is applied inside request_email_change itself (see auth.py) —
        # this per-IP rule alone doesn't stop one account probing many target
        # addresses from multiple IPs.
        "/api/v1/auth/me/email/request": (
            settings.rate_limit_otp_max_requests,
            settings.rate_limit_otp_window_seconds,
        ),
        # Admin TOTP codes (ADR-0047): same per-IP tightness as login codes; the per-admin cap
        # lives in app/api/v1/admin_mfa.py.
        "/api/v1/admin/mfa/verify": (
            settings.rate_limit_otp_verify_max_requests,
            settings.rate_limit_otp_verify_window_seconds,
        ),
        # Each call opens a Stripe Checkout Session (ADR-0048) — a real learner needs a handful.
        # The webhook next to it stays on the default rule: Stripe delivers from few IPs, and a
        # tight cap there would drop genuine payment events.
        "/api/v1/payments/checkout": (
            settings.rate_limit_checkout_max_requests,
            settings.rate_limit_checkout_window_seconds,
        ),
    },
    # Generous blanket cap for the rest of /api/v1, so new endpoints are
    # covered without touching this file again. /health is deliberately
    # excluded — Render's own reachability checks hit it directly.
    default_rule=(settings.rate_limit_default_max_requests, settings.rate_limit_default_window_seconds),
    scope_prefix="/api/v1",
    # Only trusted when actually running on Render — elsewhere nothing in
    # front of the app overwrites these headers, so a client could set them.
    trusted_client_ip_headers=("cf-connecting-ip", "true-client-ip") if settings.render else (),
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    # Browsers hide all but a handful of "simple" response headers from
    # cross-origin JS unless the server explicitly exposes them — the frontend
    # and API are on different origins even in production (ADR-0015), so
    # without this the maintenance-mode header (app/core/maintenance.py) would
    # never reach frontend/src/api/client.ts.
    expose_headers=[MAINTENANCE_HEADER],
    # The frontend's session cookie (ADR-0012) needs this to ride along on
    # cross-origin fetches (e.g. the Vite dev server on :5173 calling the
    # API on :8000); safe alongside an explicit origin allowlist, never `*`.
    allow_credentials=True,
)
# Added last, so it's the outermost user middleware: every line logged while handling the
# request — including a 429 from the limiter — carries its id (app/core/log_config.py).
app.add_middleware(RequestIdMiddleware)
app.include_router(api_v1_router)


@app.get("/health")
def health(session_factory: sessionmaker[Session] = Depends(get_session_factory)):
    # Readiness, not just liveness: Render only routes traffic to a new deploy
    # once this returns 2xx, and the uptime monitor alerts on non-2xx — a
    # backend that is up but cut off from its database must not count as healthy.
    try:
        with session_factory() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Health check failed: database unreachable")
        return JSONResponse({"status": "unavailable"}, status_code=503)
    return {"status": "ok"}

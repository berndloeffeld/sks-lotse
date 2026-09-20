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
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware

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
app.add_middleware(
    RateLimitMiddleware,
    # OTP requests get their own tighter cap (bounds cost/spam per IP,
    # independent of the general cap below).
    rules={
        "/api/v1/auth/otp/request": (
            settings.rate_limit_otp_max_requests,
            settings.rate_limit_otp_window_seconds,
        ),
        # Same tightness as OTP login requests. A second, per-authenticated-user
        # cap is applied inside request_email_change itself (see auth.py) —
        # this per-IP rule alone doesn't stop one account probing many target
        # addresses from multiple IPs.
        # SSO start/callback are open and trigger outbound provider calls — capped like OTP requests.
        **{
            f"/api/v1/auth/sso/{provider}/{leg}": (
                settings.rate_limit_otp_max_requests,
                settings.rate_limit_otp_window_seconds,
            )
            for provider in ("google", "facebook")
            for leg in ("start", "callback")
        },
        "/api/v1/auth/me/email/request": (
            settings.rate_limit_otp_max_requests,
            settings.rate_limit_otp_window_seconds,
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
    # The frontend's session cookie (ADR-0012) needs this to ride along on
    # cross-origin fetches (e.g. the Vite dev server on :5173 calling the
    # API on :8000); safe alongside an explicit origin allowlist, never `*`.
    allow_credentials=True,
)
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

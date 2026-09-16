from fastapi import FastAPI

from app.api.v1 import router as api_v1_router
from app.core.canonical_domain import RedirectSecondaryDomainsMiddleware
from app.core.rate_limit import RateLimitMiddleware

app = FastAPI(title="SKS Lotse API")
app.add_middleware(RedirectSecondaryDomainsMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    # OTP requests get their own tighter cap (bounds cost/spam per IP,
    # independent of the general cap below).
    rules={"/api/v1/auth/otp/request": (20, 3600)},
    # Generous blanket cap for the rest of /api/v1, so new endpoints are
    # covered without touching this file again. /health is deliberately
    # excluded — Render's own reachability checks hit it directly.
    default_rule=(300, 300),
    scope_prefix="/api/v1",
)
app.include_router(api_v1_router)


@app.get("/health")
def health():
    return {"status": "ok"}

from fastapi import Depends, FastAPI

from app.api.v1 import router as api_v1_router
from app.core.canonical_domain import RedirectSecondaryDomainsMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.core.security import require_access_key

app = FastAPI(title="SKS Lotse API")
app.add_middleware(RedirectSecondaryDomainsMiddleware)
# IP-based backstop against spraying OTP requests across many random emails —
# the per-email cooldown/window in app/api/v1/auth.py doesn't catch that.
app.add_middleware(RateLimitMiddleware, rules={"/api/v1/auth/otp/request": (20, 3600)})
# /health is deliberately left ungated for Render's own reachability checks.
app.include_router(api_v1_router, dependencies=[Depends(require_access_key)])


@app.get("/health")
def health():
    return {"status": "ok"}

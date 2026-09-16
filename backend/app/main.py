from fastapi import Depends, FastAPI

from app.api.v1 import router as api_v1_router
from app.core.canonical_domain import RedirectSecondaryDomainsMiddleware
from app.core.security import require_access_key

app = FastAPI(title="SKS Lotse API")
app.add_middleware(RedirectSecondaryDomainsMiddleware)
# /health is deliberately left ungated for Render's own reachability checks.
app.include_router(api_v1_router, dependencies=[Depends(require_access_key)])


@app.get("/health")
def health():
    return {"status": "ok"}

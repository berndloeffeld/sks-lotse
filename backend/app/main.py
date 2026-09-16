from fastapi import FastAPI

from app.api.v1 import router as api_v1_router

app = FastAPI(title="SKS Lotse API")
app.include_router(api_v1_router)


@app.get("/health")
def health():
    return {"status": "ok"}

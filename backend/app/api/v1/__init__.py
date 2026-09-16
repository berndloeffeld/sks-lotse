from fastapi import APIRouter

from app.api.v1.questions import router as questions_router

router = APIRouter(prefix="/api/v1")
router.include_router(questions_router)

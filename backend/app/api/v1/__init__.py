from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.exams import router as exams_router
from app.api.v1.grading import router as grading_router
from app.api.v1.pricing import router as pricing_router
from app.api.v1.progress import router as progress_router
from app.api.v1.questions import router as questions_router
from app.api.v1.questions import topics_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(questions_router)
router.include_router(grading_router)
router.include_router(topics_router)
router.include_router(progress_router)
router.include_router(exams_router)
router.include_router(admin_router)
router.include_router(pricing_router)

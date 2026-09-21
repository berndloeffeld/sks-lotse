from app.models.app_setting import AppSetting  # noqa: F401 — registers the model with Base.metadata
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.focus_topic import FocusTopic
from app.models.otp_code import OtpCode
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User

__all__ = [
    "ExamAttempt",
    "ExamAttemptQuestion",
    "FocusTopic",
    "OtpCode",
    "Question",
    "QuestionProgress",
    "QuestionReport",
    "Topic",
    "User",
]

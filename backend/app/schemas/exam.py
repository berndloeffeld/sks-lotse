from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.progress import GradingOutcomeField
from app.schemas.question import QuestionImage

# Generous for a written exam answer, but bounds what one request can store.
ANSWER_MAX_LENGTH = 10_000


class ExamAnswerUpdate(BaseModel):
    answer_text: str = Field(max_length=ANSWER_MAX_LENGTH)


class ExamGradeUpdate(BaseModel):
    outcome: GradingOutcomeField


class ExamQuestionRead(BaseModel):
    position: int
    subject_group: str
    question_id: int | None
    # None when the question has since vanished from the catalog.
    subject: str | None
    number: int | None
    question_text: str | None
    question_images: list[QuestionImage]
    # The learner's own answer.
    answer_text: str | None
    # Withheld until the exam is submitted, so it can't leak during the exam.
    official_answer: str | None
    official_answer_images: list[QuestionImage]
    outcome: str | None
    points: int | None


class ExamGroupScore(BaseModel):
    subject_group: str
    points: int
    max_points: int


class ExamSummary(BaseModel):
    id: int
    status: str
    exam_variant: str
    started_at: datetime
    submitted_at: datetime | None
    timed_out: bool
    answered_count: int
    question_count: int
    # Only once the self-assessment is complete.
    points: int | None
    max_points: int
    result: str | None


class ExamRead(ExamSummary):
    deadline_at: datetime
    # Lets the client correct for a wrong device clock when counting down.
    server_now: datetime
    group_scores: list[ExamGroupScore] | None
    questions: list[ExamQuestionRead]


class ExamStatsPoint(BaseModel):
    exam_id: int
    submitted_at: datetime
    points: int
    result: str


class ExamStats(BaseModel):
    completed_count: int
    passed_count: int
    average_points: float | None
    best_points: int | None
    max_points: int
    # Most recent last, at most 10.
    recent: list[ExamStatsPoint]
    # Share of possible points per subject group across all completed exams.
    group_scores: list[ExamGroupScore]

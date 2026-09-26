from typing import Annotated, get_args

from pydantic import BaseModel

from app.core.progress import GradingOutcome
from app.schemas.common import one_of


class TopicProgressRead(BaseModel):
    subject: str
    topic_slug: str
    topic_name: str
    display_order: int
    total_questions: int
    learned_questions: int
    # "Teilweise gelernt": answered right at least once, but not (or no
    # longer) gelernt — see app/core/progress.py.
    learning_questions: int
    is_focus: bool


class QuestionProgressRead(BaseModel):
    question_id: int
    # 0-1 position for the course gauge (progress_fraction()), not a step count.
    progress: float
    learned: bool


class RefreshSummaryRead(BaseModel):
    """Question counts behind the Auffrischen tab; only questions that reached "gelernt" at some point."""

    # Due date passed: possibly faded.
    lapsed: int
    # Due within the refresh window: could fade soon.
    expiring: int
    # Still gelernt beyond the window.
    fresh: int


# A plain str rather than the GradingOutcome Literal — see one_of.
GradingOutcomeField = Annotated[str, one_of("outcome", get_args(GradingOutcome))]


class QuestionGradeCreate(BaseModel):
    outcome: GradingOutcomeField

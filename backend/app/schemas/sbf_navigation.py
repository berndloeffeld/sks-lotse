from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SbfImage(BaseModel):
    src: str  # file name below frontend/src/sbf/navigation/originals/
    width: int
    height: int


class SbfChartSection(BaseModel):
    """One of the chart sections of the Übungskarte D49 a task is worked in, by its two corners."""

    number: int
    corners: list[str] = Field(min_length=2, max_length=2)


class SbfPoolQuestion(BaseModel):
    number: int
    text: str


class SbfTypoFix(BaseModel):
    """An obvious typo in the official text, corrected by decision of the operator (ADR-0068)."""

    task: int
    subtask: int
    field: Literal["text", "result"]
    official: str
    corrected: str


class SbfSubtaskOriginal(BaseModel):
    """The subtask as the PDF prints it: its table row, and apart its result (shown once answered)."""

    question: SbfImage
    result: SbfImage


class SbfSubtask(BaseModel):
    number: int
    text: str = Field(min_length=1)
    result: str = Field(min_length=1)
    # SKS Lotse's own, not official: the usual exam practice (ADR-0068). None where no number applies.
    own_tolerance: str | None
    original: SbfSubtaskOriginal | None = None


class SbfNavigationTask(BaseModel):
    number: int
    situation: list[str] = Field(min_length=1)
    subtasks: list[SbfSubtask]
    footnotes: list[str] = []


class SbfNavigationCatalog(BaseModel):
    """The SBF See Navigationsaufgaben as committed in app/data/sbf_navigation.yaml (ADR-0068)."""

    source: str
    # The chart the tasks are based on, the one sentence the hints show.
    chart_notice: str
    sections_notice: str
    chart_sections: list[SbfChartSection]
    pool_notice: str
    pool: list[SbfPoolQuestion]
    # SpFV Anlage 3 Nr. 1.3, the aids allowed in the exam.
    aids: list[str]
    # 1 point per subtask (SpFV Anlage 3 Nr. 1.1); passed from this many (ELWIS Bewertungsschlüssel).
    pass_points: int
    scoring: list[str]
    typo_fixes: list[SbfTypoFix]
    tasks: list[SbfNavigationTask]


# A run with an account (ADR-0071). The tasks themselves — situation, subtasks, results — come to the
# page from the export (frontend/src/sbf/data/sbf_navigation.gen.json), so the run carries only the
# learner's own state.

ANSWER_MAX_LENGTH = 5000


class SbfNavigationAiSuggestion(BaseModel):
    """The Lotsen-Check's suggestion for one answered subtask — the learner still gives the point."""

    correct: bool
    feedback: str
    # Where the learner probably went wrong; empty when nothing is.
    suspected_error: str


class SbfNavigationSubtaskRead(BaseModel):
    number: int
    answer_text: str
    # 0 or 1; None while answered but not yet assessed.
    point: int | None
    # Whether the Lotsen-Check can look at it: not when the result is an entry in the chart.
    ai_checkable: bool
    ai_suggestion: SbfNavigationAiSuggestion | None


class SbfNavigationAttemptRead(BaseModel):
    id: int
    task_number: int
    started_at: datetime
    completed_at: datetime | None
    subtask_count: int
    points: int
    # The subtask to work on next; None once the run is complete.
    current_subtask: int | None
    # The answered subtasks, in order.
    subtasks: list[SbfNavigationSubtaskRead]


class SbfNavigationTaskSummary(BaseModel):
    number: int
    # The learner's run still in progress for this task, if any, and how far it got.
    open_attempt_id: int | None
    open_answered: int | None
    completed_count: int
    # Points and date of the most recently completed run.
    last_points: int | None
    last_completed_at: datetime | None


class SbfNavigationOverview(BaseModel):
    pass_points: int
    tasks: list[SbfNavigationTaskSummary]


class SbfNavigationAiCheckRead(BaseModel):
    attempt: SbfNavigationAttemptRead
    tokens_remaining: int


class SbfNavigationAnswerUpdate(BaseModel):
    # Empty is allowed: "don't know" is an answer too, the result still follows.
    answer_text: str = Field(max_length=ANSWER_MAX_LENGTH)


class SbfNavigationPointUpdate(BaseModel):
    point: int = Field(ge=0, le=1)

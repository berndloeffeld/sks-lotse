from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.derivation import DerivationBlock

# Generous for a chart-task answer (a few values and a sentence), but bounds what one request stores.
ANSWER_MAX_LENGTH = 5_000


class ChartImage(BaseModel):
    src: str  # path below /charts/ on the static site
    width: int
    height: int


class ChartQuestion(BaseModel):
    points: int
    text: str


class ChartResult(BaseModel):
    """One line of an official solution: a result with its tolerance, or a working line (no tolerance)."""

    text: str
    tolerance: str | None = None


class ChartSolutionPart(BaseModel):
    """What one point bullet of the official solution covers."""

    results: list[ChartResult]
    # A drawing that scores, the current triangle: kept as the PDF's image.
    image: ChartImage | None = None


class ChartTask(BaseModel):
    """One task of an exercise as committed in app/data/chart_exercises.yaml."""

    number: int
    points: int
    text: str
    questions: list[ChartQuestion]
    # The task as the PDF prints it, cut into images (one per page it spans), shown beside the Formblatt
    # (ADR-0063).
    task_images: list[ChartImage] = Field(min_length=1)
    # The official solution as the PDF prints it; withheld like `solution` until the task is answered.
    solution_images: list[ChartImage] = Field(min_length=1)
    # The official solution's results (what scores), and the working that leads to them — tide tables,
    # the stream diamond read off, the course conversion, ... — which the app shows only on request.
    solution: list[ChartSolutionPart]
    derivation: list[DerivationBlock] = []


class ChartExercise(BaseModel):
    number: int
    # Our own words, not the WSV's: the tour ("Cuxhaven → Büsum") and a one-line summary for the list.
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    tasks: list[ChartTask]


class ChartExerciseCatalog(BaseModel):
    """The whole committed YAML: the ten sheets plus what every sheet shares."""

    source: str
    hints: list[str]
    tide_form: ChartImage
    sheets: list[ChartExercise]


class ChartExerciseSummary(BaseModel):
    number: int
    title: str
    summary: str
    task_count: int
    max_points: int
    # The learner's run still in progress for this exercise, if any.
    open_attempt_id: int | None
    completed_count: int
    # Points of the most recently completed run.
    last_points: int | None


class ChartExercisesOverview(BaseModel):
    source: str
    hints: list[str]
    tide_form: ChartImage
    exercises: list[ChartExerciseSummary]


class ChartAiSuggestion(BaseModel):
    """The Lotsen-Check's suggestion for one answered task (ADR-0058) — the learner still gives the points."""

    points: int
    feedback: str
    # Where the learner probably went wrong; empty when nothing is.
    suspected_error: str


class ChartAttemptTaskRead(BaseModel):
    number: int
    max_points: int
    text: str
    questions: list[ChartQuestion]
    task_images: list[ChartImage]
    solution_images: list[ChartImage]
    # The learner's answer; None while the task is still open.
    answer_text: str | None
    # Both withheld until the task is answered, so the solution can't be read ahead.
    solution: list[ChartSolutionPart]
    derivation: list[DerivationBlock]
    points_awarded: int | None
    # Whether the Lotsen-Check can look at this task at all: not when a drawing scores (ADR-0058).
    ai_checkable: bool
    ai_suggestion: ChartAiSuggestion | None


class ChartAttemptRead(BaseModel):
    id: int
    exercise_number: int
    started_at: datetime
    completed_at: datetime | None
    task_count: int
    max_points: int
    # Sum of the points given so far.
    points: int
    # The task to work on next; None once the run is complete.
    current_task: int | None
    # Every task up to and including the current one — later tasks stay hidden.
    tasks: list[ChartAttemptTaskRead]


class ChartAiCheckRead(BaseModel):
    attempt: ChartAttemptRead
    tokens_remaining: int


class ChartAnswerUpdate(BaseModel):
    # Empty is allowed: "don't know" is an answer too, the solution still follows.
    answer_text: str = Field(max_length=ANSWER_MAX_LENGTH)


class ChartPointsUpdate(BaseModel):
    points: int = Field(ge=0)

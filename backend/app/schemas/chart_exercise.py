from datetime import datetime

from pydantic import BaseModel, Field

# Generous for a chart-task answer (a few values and a sentence), but bounds what one request stores.
ANSWER_MAX_LENGTH = 5_000


class ChartImage(BaseModel):
    src: str  # path below /charts/ on the static site
    width: int
    height: int


class ChartQuestion(BaseModel):
    points: int
    text: str


class ChartTask(BaseModel):
    """One task of an exercise as committed in app/data/chart_exercises.yaml."""

    number: int
    points: int
    text: str
    questions: list[ChartQuestion]
    # The official solution's results (what scores), and the working above them — tide tables, the
    # stream diamond read off, ... — which the app shows only on request.
    solution_images: list[ChartImage]
    derivation_images: list[ChartImage]


class ChartExercise(BaseModel):
    number: int
    tasks: list[ChartTask]


class ChartExerciseCatalog(BaseModel):
    """The whole committed YAML: the ten sheets plus what every sheet shares."""

    source: str
    hints: list[str]
    tide_form: ChartImage
    sheets: list[ChartExercise]


class ChartExerciseSummary(BaseModel):
    number: int
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


class ChartAttemptTaskRead(BaseModel):
    number: int
    max_points: int
    text: str
    questions: list[ChartQuestion]
    # The learner's answer; None while the task is still open.
    answer_text: str | None
    # Both withheld until the task is answered, so the solution can't be read ahead.
    solution_images: list[ChartImage]
    derivation_images: list[ChartImage]
    points_awarded: int | None


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


class ChartAnswerUpdate(BaseModel):
    # Empty is allowed: "don't know" is an answer too, the solution still follows.
    answer_text: str = Field(max_length=ANSWER_MAX_LENGTH)


class ChartPointsUpdate(BaseModel):
    points: int = Field(ge=0)

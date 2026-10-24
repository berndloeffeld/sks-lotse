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

"""The SBF See Navigationsaufgaben as committed (ADR-0068): complete, and worded as the PDF has them."""

import re

import pymupdf
import pytest

from app.services import sbf_navigation as service
from scripts import extract_sbf_navigation as extract

# The fields that are the official text (everything else is SKS Lotse's own or a cut of the PDF).
OFFICIAL_TOP = ("chart_notice", "sections_notice", "chart_sections", "pool_notice", "pool", "typo_fixes")


def test_fifteen_tasks_of_nine_subtasks_each():
    data = service.catalog()
    assert [task.number for task in data.tasks] == list(range(1, 16))
    for task in data.tasks:
        assert [subtask.number for subtask in task.subtasks] == list(range(1, 10)), task.number
        assert service.max_points(task) == 9


def test_passed_from_seven_of_nine():
    # ELWIS Bewertungsschlüssel (Stand 31.10.2022): Navigationsaufgabe 9 Punkte, bestanden ab 7.
    assert service.catalog().pass_points == 7


def test_the_notice_has_eight_chart_sections_and_the_pool_of_fifteen_questions():
    data = service.catalog()
    assert data.chart_notice == (
        "Den Navigationsaufgaben liegt die Übungskarte D49 (Mündungen der Jade, Weser und Elbe) zugrunde."
    )
    assert [section.number for section in data.chart_sections] == list(range(1, 9))
    for section in data.chart_sections:
        for corner in section.corners:
            assert re.fullmatch(r"N\d{2}°\d{2},\d{2}', E\d{3}°\d{2},\d{2}'", corner), corner
    assert [question.number for question in data.pool] == list(range(286, 301))


def test_no_extraction_leftovers_in_the_text():
    data = service.catalog()
    texts = [line for task in data.tasks for line in task.situation + task.footnotes]
    subtasks = [subtask for task in data.tasks for subtask in task.subtasks]
    texts += [subtask.text for subtask in subtasks] + [subtask.result for subtask in subtasks]
    for text in texts:
        assert "­" not in text and "  " not in text and text == text.strip(), text


def test_every_typo_fix_is_in_place():
    data = service.catalog()
    for fix in data.typo_fixes:
        field = getattr(data.tasks[fix.task - 1].subtasks[fix.subtask - 1], fix.field)
        assert fix.corrected in field and fix.official not in field, fix


def test_every_subtask_has_its_originals():
    for task in service.catalog().tasks:
        for subtask in task.subtasks:
            assert subtask.original, (task.number, subtask.number)
            for image in (subtask.original.question, subtask.original.result):
                assert (extract.IMAGES_DIR / image.src).is_file(), image.src


@pytest.fixture(scope="module")
def from_the_pdf():
    return extract.extract(pymupdf.open(extract.PDF_PATH))


def test_the_wording_is_the_pdfs_but_for_the_documented_typo_fixes(from_the_pdf):
    # The official wording is never changed (CLAUDE.md): the YAML says what a fresh extraction says, with
    # only TYPO_FIXES applied (ADR-0068). A hand edit of an official text fails here.
    data = service.catalog().model_dump()
    for key in OFFICIAL_TOP:
        assert data[key] == from_the_pdf[key], key
    for task, pdf in zip(data["tasks"], from_the_pdf["tasks"], strict=True):
        assert task["situation"] == pdf["situation"], task["number"]
        assert task["footnotes"] == pdf["footnotes"], task["number"]
        for subtask, pdf_subtask in zip(task["subtasks"], pdf["subtasks"], strict=True):
            assert (subtask["text"], subtask["result"]) == (pdf_subtask["text"], pdf_subtask["result"]), (
                task["number"],
                subtask["number"],
            )


def test_each_typo_fix_names_what_the_pdf_says():
    # The official text a fix replaces is really there, once, in that field of the PDF.
    raw = extract.extract(pymupdf.open(extract.PDF_PATH), fix_typos=False)
    for (task, subtask, field), (official, corrected) in extract.TYPO_FIXES.items():
        assert official != corrected
        assert raw["tasks"][task - 1]["subtasks"][subtask - 1][field].count(official) == 1, (task, subtask)

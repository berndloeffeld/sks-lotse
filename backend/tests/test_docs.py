"""Keeps the docs' cross-references honest: the ADR index, links and their anchors, tables, ADR
counter-status and headings, the section names code and config cite, the AGB version label.

The docs move content between files (out of the top-level project file into the architecture
overview and the runbook, ...); a link that still points at the old place, an anchor whose heading
was renamed, or an index that forgot an ADR fails here instead of rotting. Files only, no network.
"""

import os
import re
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from functools import cache
from pathlib import Path
from urllib.parse import unquote

import pytest

from app.domain.legal import CURRENT_AGB_VERSION

REPO = Path(__file__).resolve().parents[2]
ADR_DIR = REPO / "docs" / "adr"
DOCS = [
    REPO / "CLAUDE.md",
    REPO / "README.md",
    REPO / "SECURITY.md",
    REPO / "frontend" / "README.md",
    *sorted((REPO / "docs").glob("*.md")),
    REPO / "docs" / "stripe" / "README.md",
    # template.md is excluded: its links are placeholders (NNNN-title.md).
    *sorted(p for p in ADR_DIR.glob("*.md") if p.name != "template.md"),
]
# [text](target) — not images, not in-page anchors; external URLs are skipped below.
_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)\)")


def _adrs() -> list[Path]:
    return sorted(ADR_DIR.glob("[0-9][0-9][0-9][0-9]-*.md"))


def _status(adr: Path) -> str:
    line = next(line for line in adr.read_text().splitlines() if line.startswith("Status:"))
    return line.removeprefix("Status:").strip()


def test_every_adr_has_a_status_line():
    for adr in _adrs():
        assert _status(adr), adr.name


def test_adr_index_lists_every_adr_with_its_current_status():
    index = (ADR_DIR / "README.md").read_text()
    rows = dict(re.findall(r"^\| \[\d{4}\]\(([^)]+)\) \| [^|]+ \| (.+) \|$", index, re.MULTILINE))
    assert set(rows) == {adr.name for adr in _adrs()}
    for adr in _adrs():
        assert rows[adr.name] == _status(adr), f"{adr.name}: index status differs from the file"


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: str(p.relative_to(REPO)))
def test_relative_links_point_at_existing_files(doc):
    broken = []
    for target in _LINK.findall(doc.read_text()):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        path = target.split("#", 1)[0]
        if not (doc.parent / path).exists():
            broken.append(target)
    assert broken == []


# --- anchors ---------------------------------------------------------------------------------


def _prose(path: Path) -> Iterator[tuple[int, str]]:
    """(line number, text) of every line outside a fenced code block."""
    fenced = False
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.lstrip().startswith(("```", "~~~")):
            fenced = not fenced
        elif not fenced:
            yield number, line


_HEADING = re.compile(r"^#{1,6}\s+(.*?)(?:\s+#+)?\s*$")


@cache
def _headings(path: Path) -> list[str]:
    return [m.group(1) for _, line in _prose(path) if (m := _HEADING.match(line))]


def _slug(heading: str) -> str:
    """GitHub's anchor for a heading: no markup, lowercase, punctuation dropped, spaces to hyphens."""
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading).replace("`", "").strip().lower()
    return re.sub(r"[^\w\- ]", "", text).replace(" ", "-")


@cache
def _anchors(path: Path) -> set[str]:
    seen: dict[str, int] = {}
    anchors = set()
    for heading in _headings(path):
        slug = _slug(heading)
        count = seen.get(slug, 0)  # a repeated heading gets -1, -2, ... like on GitHub
        seen[slug] = count + 1
        anchors.add(slug if count == 0 else f"{slug}-{count}")
    return anchors


@pytest.mark.parametrize(
    ("heading", "slug"),
    [
        ("Auth & rate limiting", "auth--rate-limiting"),
        ("`security.txt`", "securitytxt"),
        ("Sicherheit [und](x.md) Recht", "sicherheit-und-recht"),
        ("Löschung (DSGVO)", "löschung-dsgvo"),
        ("Data_layer: 3-way", "data_layer-3-way"),
    ],
)
def test_slug_follows_githubs_rules(heading, slug):
    assert _slug(heading) == slug


def _missing_anchor(doc: Path, target: str) -> str | None:
    """Why `target` (a link to a Markdown file or to this one) names no heading, else None."""
    file, _, fragment = target.partition("#")
    dest = doc.parent / file if file else doc
    if not fragment or dest.suffix != ".md" or not dest.is_file():
        return None
    if unquote(fragment) in _anchors(dest):
        return None
    return f"no heading with that anchor in {dest.relative_to(REPO)}"


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: str(p.relative_to(REPO)))
def test_link_anchors_point_at_existing_headings(doc):
    broken = [
        f"{doc.relative_to(REPO)}:{number}: ({target}) {why}"
        for number, line in _prose(doc)
        for target in _LINK.findall(line)
        if not target.startswith(("http://", "https://", "mailto:")) and (why := _missing_anchor(doc, target))
    ]
    assert broken == []


# --- tables ----------------------------------------------------------------------------------

_SEPARATOR_ROW = re.compile(r"^\s*\|(?:\s*:?-+:?\s*\|)+\s*$")


def _cell_count(row: str) -> int:
    """Cells in a table row; an escaped pipe (`\\|`) belongs to its cell, any other one splits."""
    body = row.strip().replace("\\|", "")[1:]
    return len(body.removesuffix("|").split("|"))


def _table_blocks(doc: Path) -> Iterator[list[tuple[int, str]]]:
    block: list[tuple[int, str]] = []
    for number, line in _prose(doc):
        if line.lstrip().startswith("|") and (not block or block[-1][0] == number - 1):
            block.append((number, line))
            continue
        if block:
            yield block
        block = [(number, line)] if line.lstrip().startswith("|") else []
    if block:
        yield block


@pytest.mark.parametrize("doc", DOCS, ids=lambda p: str(p.relative_to(REPO)))
def test_table_rows_have_as_many_cells_as_their_header(doc):
    uneven = []
    for block in _table_blocks(doc):
        if len(block) < 2 or not _SEPARATOR_ROW.match(block[1][1]):
            continue
        width = _cell_count(block[0][1])
        uneven += [
            f"{doc.relative_to(REPO)}:{number}: {_cell_count(row)} cells, header has {width}"
            for number, row in block[2:]
            if _cell_count(row) != width
        ]
    assert uneven == []


# --- ADRs: counter-status and headings -------------------------------------------------------

_RELATION = re.compile(
    r"(superseded by|amended by|partially supersedes|supersedes|amends|replaces)\s+"
    r"(ADR-\d{4}(?:(?:\s*,\s*|\s+and\s+|\s*,\s*and\s+)ADR-\d{4})*)",
    re.IGNORECASE,
)


def _related_adrs(status: str) -> list[tuple[str, str]]:
    """(relation, ADR number) for each ADR a status line names right after a relation word.

    Links are flattened to `ADR-NNNN` and parenthetical remarks dropped, so a remark about a third
    ADR ("... superseded by ADR-0057") isn't read as this ADR's relation. Only the list directly
    after the word counts: "supersedes the merge criterion of ADR-0017" is not picked up.
    """
    text = re.sub(r"\[ADR-(\d{4})\]\([^)]*\)", r"ADR-\1", status)
    while (flat := re.sub(r"\([^()]*\)", "", text)) != text:
        text = flat
    return [
        (m.group(1).lower(), number)
        for m in _RELATION.finditer(text)
        for number in re.findall(r"ADR-(\d{4})", m.group(2))
    ]


def test_adr_status_relations_are_linked_back_from_the_other_adr():
    adrs = {adr.name[:4]: adr for adr in _adrs()}
    unlinked = [
        f"{adr.name} says '{relation} ADR-{other}', but {adrs[other].name} never mentions ADR-{number}"
        for number, adr in adrs.items()
        for relation, other in _related_adrs(_status(adr))
        if other in adrs
        and other != number
        and not re.search(rf"ADR-{number}\b|\b{number}-[a-z]", adrs[other].read_text(encoding="utf-8"))
    ]
    assert unlinked == []


def test_adr_headings_start_with_the_four_digit_number_of_the_file():
    wrong = [
        f"{adr.name}: heading is {heading!r}, expected it to start with '# {adr.name[:4]}. '"
        for adr in _adrs()
        if not (heading := adr.read_text(encoding="utf-8").splitlines()[0]).startswith(f"# {adr.name[:4]}. ")
    ]
    assert wrong == []


# --- sections of the top-level project file cited from code and config -----------------------

_SECTION_REF = re.compile(r"CLAUDE\.md\s*(?:→|->|,)\s*(.+)")
_SCANNED_DIRS = ("backend", "scripts", ".github")
_SCANNED_SUFFIXES = {".py", ".sh", ".yml", ".yaml", ".md", ".toml"}
# Dependencies, caches (all dot-directories below the top ones) and mutmut's generated copy of the
# source tree (gitignored).
_SKIPPED_DIRS = {"venv", "node_modules", "mutants", "__pycache__", "htmlcov"}
_COMMENT_LEADER = re.compile(r"^\s*(?:#+|//|\*|--)?\s*")


def _cited_files() -> Iterator[Path]:
    yield REPO / "render.yaml"
    for top in _SCANNED_DIRS:
        for root, dirs, files in os.walk(REPO / top):
            dirs[:] = [d for d in dirs if d not in _SKIPPED_DIRS and not d.startswith(".")]
            yield from (Path(root) / f for f in files if Path(f).suffix in _SCANNED_SUFFIXES)


def _is_section(text: str, headings: list[str]) -> bool:
    """Whether `text` starts with a heading, as a whole word (so "Full review" is not "Full reviews")."""
    return any(text.startswith(h) and not text[len(h) :][:1].isalnum() for h in headings)


def test_cited_sections_of_the_project_file_exist():
    headings = _headings(REPO / "CLAUDE.md")
    missing = []
    for path in _cited_files():
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for number, line in enumerate(lines, 1):
            if not (m := _SECTION_REF.search(line)):
                continue
            # A comment may wrap right inside the section name; read on into the next line.
            following = _COMMENT_LEADER.sub("", lines[number]) if number < len(lines) else ""
            if not _is_section(f"{m.group(1)} {following}", headings):
                missing.append(
                    f"{path.relative_to(REPO)}:{number}: '{m.group(1).strip()}' is no heading of CLAUDE.md"
                )
    assert missing == []


# --- AGB version -----------------------------------------------------------------------------

LEGAL_TS = REPO / "frontend" / "src" / "legal.ts"
_GERMAN_MONTHS = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
]


def test_agb_version_label_in_the_frontend_matches_the_backend_version():
    # The label is what AgbPage shows as "Stand:", the backend version is what accounts accept; they
    # are bumped together (both files say so). The "Stand:" of the Datenschutzerklärung is not tied.
    match = re.search(r"AGB_VERSION_LABEL\s*=\s*['\"]([^'\"]+)['\"]", LEGAL_TS.read_text(encoding="utf-8"))
    assert match, "frontend/src/legal.ts has no AGB_VERSION_LABEL"
    version = date.fromisoformat(CURRENT_AGB_VERSION)
    expected = f"{version.day}. {_GERMAN_MONTHS[version.month - 1]} {version.year}"

    assert match.group(1) == expected, (
        f"AGB_VERSION_LABEL is '{match.group(1)}' but CURRENT_AGB_VERSION {CURRENT_AGB_VERSION} "
        f"reads '{expected}': bump both together (backend/app/domain/legal.py, frontend/src/legal.ts)"
    )


# --- security.txt (RFC 9116) ------------------------------------------------------------------

SECURITY_TXT = REPO / "frontend" / "public" / ".well-known" / "security.txt"
# Renewing means a PR; two months is time enough to notice a red CI and do it.
SECURITY_TXT_RENEW_BEFORE = timedelta(days=60)


def test_security_txt_expires_far_enough_ahead_to_renew_in_time():
    # Goes red 60 days before the date in `Expires`: move it forward (at most a year ahead, RFC 9116)
    # and keep docs/RUNBOOK.md → security.txt in step.
    match = re.search(r"^Expires:\s*(\S+)\s*$", SECURITY_TXT.read_text(encoding="utf-8"), re.MULTILINE)
    assert match, "security.txt has no Expires field"
    expires = datetime.fromisoformat(match.group(1).replace("Z", "+00:00"))

    remaining = expires - datetime.now(UTC)

    assert remaining > SECURITY_TXT_RENEW_BEFORE, (
        f"security.txt expires {expires:%Y-%m-%d}, in {remaining.days} days: renew its Expires field "
        "(docs/RUNBOOK.md → security.txt)"
    )

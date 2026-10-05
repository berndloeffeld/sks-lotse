"""Keeps the docs' cross-references honest: the ADR index and every relative link.

The docs move content between files (CLAUDE.md → ARCHITECTURE.md, RUNBOOK.md, ...); a link that
still points at the old place, or an index that forgot an ADR, fails here instead of rotting.
"""

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

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

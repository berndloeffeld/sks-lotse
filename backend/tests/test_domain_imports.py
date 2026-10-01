"""Keeps app/domain/ free of infrastructure (docs/ARCHITECTURE.md → Backend).

The product rules import neither `Settings`, a DB session nor FastAPI: whatever reads the
configuration or the database lives in app/services/. Models and SQLAlchemy expressions are
allowed (the "gelernt" rule has a SQL form next to its Python form). Checks direct imports only.
"""

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DOMAIN = BACKEND / "app" / "domain"

FORBIDDEN = (
    "fastapi",
    "starlette",
    "sqlalchemy.orm",
    "app.core.config",
    "app.core.database",
    "app.api",
    "app.services",
)


def _imported_names(path: Path) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
            # `from app.core import config` imports the module app.core.config.
            names.update(f"{node.module}.{alias.name}" for alias in node.names)
    return names


def _is_forbidden(name: str) -> bool:
    return any(name == prefix or name.startswith(f"{prefix}.") for prefix in FORBIDDEN)


def test_domain_modules_import_no_infrastructure():
    violations = sorted(
        f"{path.relative_to(BACKEND).as_posix()}: {name}"
        for path in DOMAIN.glob("*.py")
        for name in _imported_names(path)
        if _is_forbidden(name)
    )
    assert not violations, (
        f"{violations}: app/domain/ must not import Settings, a DB session or FastAPI — move the "
        "code that needs them to app/services/."
    )


def test_the_check_recognises_a_forbidden_import():
    assert _is_forbidden("sqlalchemy.orm")
    assert _is_forbidden("app.core.config")
    assert not _is_forbidden("app.core.timeutil")
    assert not _is_forbidden("sqlalchemy")

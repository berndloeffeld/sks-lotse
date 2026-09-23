"""Keeps the mutation-testing scope (`only_mutate` in pyproject.toml) in step with the code.

A backend module missing from `only_mutate` is silently unchecked by mutmut (see
docs/mutation-testing.md), so a new module has to be listed there or excluded here on purpose.
"""

import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SCANNED = ("app/core", "app/services", "app/api/v1")

# Deliberately not mutated (CLAUDE.md → Mutation testing): configuration/wiring and the catalog
# importer, whose tests read files outside backend/ that mutmut's working copy doesn't have.
EXCLUDED = {
    "app/core/config.py",
    "app/core/database.py",
    "app/services/catalog_seed.py",
    # A single constant, no branching logic to mutate — same reasoning as config.py.
    "app/core/legal.py",
}


def _only_mutate() -> set[str]:
    config = tomllib.loads((BACKEND / "pyproject.toml").read_text())
    return set(config["tool"]["mutmut"]["only_mutate"])


def _modules() -> set[str]:
    return {
        path.relative_to(BACKEND).as_posix()
        for directory in SCANNED
        for path in (BACKEND / directory).glob("*.py")
        if path.name != "__init__.py"
    }


def test_every_backend_module_is_in_the_mutation_scope_or_excluded_on_purpose():
    missing = sorted(_modules() - _only_mutate() - EXCLUDED)
    assert not missing, (
        f"{missing} not in [tool.mutmut] only_mutate (backend/pyproject.toml): add them there, or to "
        "EXCLUDED in this test with a reason. See CLAUDE.md → Mutation testing."
    )


def test_the_mutation_scope_lists_no_module_that_no_longer_exists():
    stale = sorted(path for path in _only_mutate() if not (BACKEND / path).is_file())
    assert not stale, f"{stale} in only_mutate but the file is gone — remove or rename the entry."


def test_excluded_modules_exist_and_are_not_also_in_scope():
    assert all((BACKEND / path).is_file() for path in EXCLUDED), "an EXCLUDED module no longer exists"
    assert not EXCLUDED & _only_mutate(), "a module is both in only_mutate and EXCLUDED"

"""Prepare a throw-away copy of backend/ in which mutmut can mutate the FastAPI route handlers.

mutmut skips every decorated function (its trampoline can't wrap them), which is every
`@router.get(...)` handler. In the copy, each decorator is moved behind the definition —
`@router.get(...) def f(): ...` becomes `def f(): ...` + `f = router.get(...)(f)` — which
FastAPI registers identically, and `only_mutate` is narrowed to app/api/v1/.

Usage: python scripts/mutation_handlers_setup.py <destination-dir>
The repository itself is never modified. Called by scripts/run_mutation_tests.sh handlers.
"""

import ast
import re
import shutil
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
IGNORE = shutil.ignore_patterns(
    ".venv", "mutants", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".coverage"
)


def undecorate(source: str) -> tuple[str, int]:
    """Move each top-level decorated function's decorators behind it; returns (source, function count)."""
    tree = ast.parse(source)
    body: list[ast.stmt] = []
    moved = 0
    for node in tree.body:
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.decorator_list:
            decorators, node.decorator_list = node.decorator_list, []
            body.append(node)
            for decorator in reversed(decorators):
                call = ast.Call(func=decorator, args=[ast.Name(node.name, ast.Load())], keywords=[])
                body.append(ast.Assign(targets=[ast.Name(node.name, ast.Store())], value=call))
            moved += 1
        else:
            body.append(node)
    tree.body = body
    return ast.unparse(ast.fix_missing_locations(tree)) + "\n", moved


def main(destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(BACKEND, destination, ignore=IGNORE)
    total = 0
    for path in (destination / "app" / "api" / "v1").glob("*.py"):
        source, moved = undecorate(path.read_text())
        path.write_text(source)
        total += moved
    pyproject = destination / "pyproject.toml"
    text = pyproject.read_text()
    only_handlers = 'only_mutate = ["app/api/v1/*.py"]'
    text = re.sub(r"only_mutate = \[.*?\n\]", only_handlers, text, count=1, flags=re.DOTALL)
    pyproject.write_text(text)
    print(f"{total} route handlers made mutable in {destination}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

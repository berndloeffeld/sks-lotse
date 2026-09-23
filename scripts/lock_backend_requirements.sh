#!/usr/bin/env bash
# Regenerates the hash-pinned backend locks (backend/requirements*.txt) from their declared
# dependencies (backend/requirements*.in) — run after editing an .in file, then commit both.
# Order matters: each lock constrains the next (dev ⊇ runtime, mutation ⊇ dev), so all three always
# agree on every shared package. See README → Dependencies.
#
# CUSTOM_COMPILE_COMMAND: pip-tools 7.6 writes a header claiming `--no-index` whatever the options
# were; Dependabot reads its pip-compile options from that header, so the header is set explicitly.
set -euo pipefail
cd "$(dirname "$0")/../backend"

PIP_COMPILE="${PIP_COMPILE:-.venv/bin/pip-compile}"
OPTIONS=(--generate-hashes --allow-unsafe --strip-extras)

for name in requirements requirements-dev requirements-mutation; do
  echo "locking $name.txt"
  CUSTOM_COMPILE_COMMAND="pip-compile ${OPTIONS[*]} $name.in" \
    "$PIP_COMPILE" --quiet "${OPTIONS[@]}" "$name.in"
done

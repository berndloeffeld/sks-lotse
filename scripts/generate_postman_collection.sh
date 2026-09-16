#!/usr/bin/env bash
# Regenerates postman/sks-lotse.postman_collection.json from the FastAPI app's
# live OpenAPI schema, so the collection can never drift from the actual API.
set -euo pipefail
cd "$(dirname "$0")/.."

OPENAPI_TMP=$(mktemp)
trap 'rm -f "$OPENAPI_TMP"' EXIT

PYTHON_BIN="${PYTHON_BIN:-backend/.venv/bin/python}"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

# Settings() only needs DATABASE_URL to satisfy validation at import time;
# generating the schema never connects to it.
DATABASE_URL="${DATABASE_URL:-postgresql://test:test@localhost:5432/test}" \
  PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/generate_openapi.py "$OPENAPI_TMP"

mkdir -p postman
POSTMAN_TMP=$(mktemp)
trap 'rm -f "$OPENAPI_TMP" "$POSTMAN_TMP"' EXIT
npx --yes openapi-to-postmanv2 -s "$OPENAPI_TMP" -o "$POSTMAN_TMP" -p

# openapi-to-postmanv2 assigns random UUIDs (id, _postman_id) on every run,
# which would make the output un-diffable across regenerations even when
# nothing about the API changed. Strip them — Postman assigns its own on
# import, so this doesn't affect usability.
jq 'walk(if type == "object" then del(.id, ._postman_id) else . end)' "$POSTMAN_TMP" \
  > postman/sks-lotse.postman_collection.json

echo "Wrote postman/sks-lotse.postman_collection.json"

#!/usr/bin/env bash
# PostToolUse (Write|Edit|MultiEdit): non-blocking reminder when an API route
# file changed. CLAUDE.md > Postman & integration tests: "After any API change
# run ./scripts/generate_postman_collection.sh and commit the result: it also
# regenerates the frontend's API types ... the required postman-collection CI
# job fails when either is stale."
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  */backend/app/api/v1/*.py | backend/app/api/v1/*.py)
    reason="You edited $file_path (backend/app/api/v1). Once the API changes are done, run ./scripts/generate_postman_collection.sh and commit the regenerated Postman collection + frontend/src/api/schema.gen.ts — the required postman-collection CI check fails when either is stale (CLAUDE.md > Postman & integration tests)."
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}' "$(printf '%s' "$reason" | jq -Rs .)"
    ;;
esac

exit 0

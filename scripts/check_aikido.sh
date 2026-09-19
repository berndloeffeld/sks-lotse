#!/usr/bin/env bash
# Prints open Aikido findings for the sks-lotse repo (whichever branch Aikido last scanned).
# Requires .env.aikido (gitignored) with AIKIDO_CLIENT_ID / AIKIDO_CLIENT_SECRET.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env.aikido
set +a

TOKEN=$(curl -s -X POST https://app.aikido.dev/api/oauth/token \
  -u "${AIKIDO_CLIENT_ID}:${AIKIDO_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r .access_token)

REPOS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://app.aikido.dev/api/public/v1/repositories/code?filter_name=sks-lotse&per_page=10")
# An API error (e.g. plan without API access) comes back as a JSON object, not a list.
if [ "$(echo "$REPOS" | jq -r type)" != "array" ]; then
  echo "Aikido API error: $(echo "$REPOS" | jq -r '.error // .')" >&2
  exit 1
fi
REPO=$(echo "$REPOS" | jq -c '.[0]')
REPO_ID=$(echo "$REPO" | jq -r .id)
BRANCH=$(echo "$REPO" | jq -r .branch)
LAST_SCAN=$(echo "$REPO" | jq -r .last_scanned_at)

echo "Repo: sks-lotse (id $REPO_ID) — last scanned branch: $BRANCH (unix $LAST_SCAN)"
echo "---"

ISSUES=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://app.aikido.dev/api/public/v1/open-issue-groups?filter_code_repo_id=${REPO_ID}&filter_status=open&per_page=50")
if [ "$(echo "$ISSUES" | jq -r type)" != "array" ]; then
  echo "Aikido API error: $(echo "$ISSUES" | jq -r '.error // .')" >&2
  exit 1
fi
echo "$ISSUES" | jq -c '.[] | {severity, type, title, time_to_fix_minutes}'

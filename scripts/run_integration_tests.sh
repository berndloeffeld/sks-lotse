#!/usr/bin/env bash
# Runs postman/integration-tests.postman_collection.json with Newman against
# a real, already-running local backend — black-box HTTP checks (auth guards,
# CORS, security headers, the full OTP login round-trip via the dev-only
# _dev-peek endpoint, rate limiting), as an alternative to pytest that needs
# no Python environment. See docs/adr/0011 for what this can and can't cover.
#
# Prerequisites:
#   - The backend is already running locally with ENVIRONMENT unset or
#     "development" (the dev-peek endpoint 404s otherwise) — e.g.:
#       cd backend && uvicorn app.main:app --reload
#   - ADMIN_EMAILS on that server must include the adminEmail collection variable
#     (default: integration-admin@example.com), or the Admin folder fails.
#   - If ALLOWED_EMAILS is set, it must include every test address: the testEmail,
#     profileEmail, profileNewEmail, adminEmail and victimEmail collection variables
#     (defaults: integration-*@example.com).
#   - Use a freshly started server (in-memory rate-limit counters + dev-peek codes)
#     and, ideally, a scratch database with the catalog seeded (alembic upgrade head)
#     - the run creates and deletes throwaway users. Leave RESEND_API_KEY empty
#     so the test addresses never get real mail.
# CI runs exactly this in backend-ci.yml's `integration-tests` job.
set -euo pipefail
cd "$(dirname "$0")/.."

COLLECTION=postman/integration-tests.postman_collection.json
ENV_FILE=postman/local.postman_environment.json

if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE — copying it from local.postman_environment.json.example (see docs/postman-and-integration-tests.md)."
  cp postman/local.postman_environment.json.example "$ENV_FILE"
fi

BASE_URL=$(jq -r '.values[] | select(.key == "baseUrl") | .value' "$ENV_FILE")
if ! curl -s -o /dev/null -f "$BASE_URL/health"; then
  echo "Backend not reachable at $BASE_URL/health — start it first (see this script's header comment)." >&2
  exit 1
fi

npx --yes newman@6.2.2 run "$COLLECTION" -e "$ENV_FILE"

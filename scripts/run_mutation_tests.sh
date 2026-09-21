#!/usr/bin/env bash
# Mutation testing of the backend's pure business-logic modules with mutmut —
# a periodic check, not a CI gate (see docs/mutation-testing.md for scope,
# reading the results and why the frontend isn't covered yet).
#
#   ./scripts/run_mutation_tests.sh           # run all mutants (~30 s)
#   ./scripts/run_mutation_tests.sh results   # list the survivors
#   ./scripts/run_mutation_tests.sh show <mutant name>   # the diff a survivor made
#
# Needs backend/.venv with requirements-mutation.txt installed. No database,
# no .env: the suite runs on in-memory SQLite, the two variables below only
# satisfy Settings() on import.
set -euo pipefail
cd "$(dirname "$0")/../backend"

MUTMUT=.venv/bin/mutmut
if [ ! -x "$MUTMUT" ]; then
  echo "mutmut not found — run: cd backend && .venv/bin/pip install -r requirements-mutation.txt" >&2
  exit 1
fi

export DATABASE_URL=postgresql://test:test@localhost:5432/test
export JWT_SECRET=45eb335498028f51fca3594cd2979ac9e9a3f9f09a908ccee3b05f054e7964ac
# On macOS, requests' proxy lookup segfaults in mutmut's forked workers, which
# then report every mutant that reaches an email send as "segfault" rather than
# killed/survived. NO_PROXY=* skips that lookup.
export NO_PROXY='*'
export PYTHONPATH=.

case "${1:-run}" in
  run) rm -rf mutants; "$MUTMUT" run; "$MUTMUT" results | grep -v ': killed' || true ;;
  *) "$MUTMUT" "$@" ;;
esac

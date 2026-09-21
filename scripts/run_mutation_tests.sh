#!/usr/bin/env bash
# Mutation testing of the backend's business logic with mutmut. `gate` is the
# required CI check (backend-ci.yml, job `mutation-testing`); the other modes are
# for working on survivors locally. See docs/mutation-testing.md for scope,
# reading the results and why the frontend isn't covered yet.
#
#   ./scripts/run_mutation_tests.sh           # run all mutants (~30 s)
#   ./scripts/run_mutation_tests.sh results   # list the survivors
#   ./scripts/run_mutation_tests.sh show <mutant name>   # the diff a survivor made
#   ./scripts/run_mutation_tests.sh gate      # run, then fail if the score is below MUTATION_MIN_SCORE
#   ./scripts/run_mutation_tests.sh handlers  # the FastAPI route handlers (~1 min), see below
#
# Needs requirements-mutation.txt installed (backend/.venv, or on the PATH as in CI). No database,
# no .env: the suite runs on in-memory SQLite, the two variables below only
# satisfy Settings() on import.
set -euo pipefail
cd "$(dirname "$0")/../backend"

# Ratchet: a few points under the current score (~89.6%), like the coverage gates. Raise it when the
# score settles higher; don't lower it to get a PR through — write the missing test (or, for a
# mutant that is truly equivalent, nothing: a handful of those are already priced in).
MUTATION_MIN_SCORE="${MUTATION_MIN_SCORE:-87}"

if [ -x .venv/bin/mutmut ]; then
  MUTMUT="$PWD/.venv/bin/mutmut"; PYTHON="$PWD/.venv/bin/python"
elif command -v mutmut >/dev/null; then
  MUTMUT="$(command -v mutmut)"; PYTHON="$(command -v python3)"
else
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
  gate)
    rm -rf mutants
    "$MUTMUT" run > /dev/null
    "$MUTMUT" results | grep -v ': killed' || true
    # killed / all mutants; a timeout counts as killed (the tests hung on it).
    read -r total killed < <("$MUTMUT" results --all true | awk '{n++} /: (killed|timeout)/{k++} END{print n+0, k+0}')
    score=$(awk -v k="$killed" -v n="$total" 'BEGIN{printf "%.1f", n ? 100*k/n : 0}')
    echo "Mutation score: $score% ($killed of $total mutants killed; minimum $MUTATION_MIN_SCORE%)"
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      echo "Mutation score: **$score%** ($killed of $total killed, minimum $MUTATION_MIN_SCORE%)" >> "$GITHUB_STEP_SUMMARY"
    fi
    if awk -v s="$score" -v m="$MUTATION_MIN_SCORE" 'BEGIN{exit !(s < m)}'; then
      echo "Below the minimum: a change left mutants alive that the tests don't catch (list above)." >&2
      echo "See docs/mutation-testing.md; inspect one with: ./scripts/run_mutation_tests.sh show <name>" >&2
      exit 1
    fi
    ;;
  handlers)
    # mutmut skips decorated functions, i.e. all route handlers. This mutates them in a throw-away
    # copy (decorators moved behind the definitions, see mutation_handlers_setup.py); the repo stays
    # untouched. Inspect afterwards with: cd "$COPY" && mutmut results | grep -v killed
    COPY="${TMPDIR:-/tmp}/sks-lotse-mutation-handlers"
    "$PYTHON" scripts/mutation_handlers_setup.py "$COPY"
    (cd "$COPY" && "$MUTMUT" run; "$MUTMUT" results | grep -v ': killed' || true)
    echo "Copy kept in $COPY (mutmut show <name> works there)."
    ;;
  *) "$MUTMUT" "$@" ;;
esac

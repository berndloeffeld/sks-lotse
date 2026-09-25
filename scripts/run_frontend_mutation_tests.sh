#!/usr/bin/env bash
# Mutation testing of the frontend's logic modules with Stryker. `gate` is what the weekly
# workflow runs (.github/workflows/mutation-testing.yml, job `frontend`; not a PR check); the plain mode
# is for working on survivors locally. See docs/mutation-testing.md for scope, reading the
# results and why Vitest is pinned to 4.x.
#
#   ./scripts/run_frontend_mutation_tests.sh        # run all mutants (~2 min), HTML report in frontend/reports/mutation/
#   ./scripts/run_frontend_mutation_tests.sh gate   # run, then fail if the score is below MUTATION_MIN_SCORE
#
# Needs `npm ci` in frontend/. No backend, no env.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

# Ratchet: a few points under the current score (~95%, 94.8% on 2026-09-25), like the coverage gates. Raise it when
# the score settles higher; don't lower it to get a PR through — write the missing test (a
# handful of equivalent survivors are already priced in).
MUTATION_MIN_SCORE="${MUTATION_MIN_SCORE:-90}"

case "${1:-run}" in
  run) npx stryker run ;;
  gate)
    rm -rf reports/mutation
    npx stryker run --reporters clear-text,json
    # Score as Stryker computes it: killed + timeout over everything that could have been
    # caught (compile/runtime errors and ignored mutants don't count). The second number is the
    # plausibility check: every mutant the tests cover must have actually run tests, otherwise
    # the runner is broken (see @stryker-mutator/vitest-runner and Vitest 5, stryker-js#6210) and
    # the score means nothing.
    read -r score killed total idle < <(node -e '
      const report = JSON.parse(require("fs").readFileSync("reports/mutation/mutation.json", "utf8"))
      const mutants = Object.values(report.files).flatMap((file) => file.mutants)
      const counted = mutants.filter((m) => ["Killed", "Timeout", "Survived", "NoCoverage"].includes(m.status))
      const killed = counted.filter((m) => m.status === "Killed" || m.status === "Timeout").length
      const idle = counted.filter((m) => m.status === "Survived" && !m.testsCompleted).length
      const score = counted.length ? (100 * killed) / counted.length : 0
      console.log(score.toFixed(1), killed, counted.length, idle)
    ')
    echo "Mutation score: $score% ($killed of $total mutants killed; minimum $MUTATION_MIN_SCORE%)"
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      echo "Frontend mutation score: **$score%** ($killed of $total killed, minimum $MUTATION_MIN_SCORE%)" >> "$GITHUB_STEP_SUMMARY"
    fi
    if [ "$idle" -gt 0 ]; then
      echo "$idle surviving mutants ran no tests at all: the Stryker Vitest runner is not working (Vitest major bumped past 4.x? see docs/mutation-testing.md)." >&2
      exit 1
    fi
    if awk -v s="$score" -v m="$MUTATION_MIN_SCORE" 'BEGIN{exit !(s < m)}'; then
      echo "Below the minimum: a change left mutants alive that the tests don't catch (list above)." >&2
      echo "See docs/mutation-testing.md." >&2
      exit 1
    fi
    ;;
  *) echo "usage: $0 [run|gate]" >&2; exit 2 ;;
esac

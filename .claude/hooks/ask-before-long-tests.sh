#!/usr/bin/env bash
# PreToolUse (Bash): blocks long-running local test suites (mutation tests,
# integration tests, full coverage runs) and hands Claude an instruction instead
# of letting them run silently. Claude must then use AskUserQuestion to ask the
# user whether to test locally first: if yes, start the "backend"/"frontend"
# preview_start configs from .claude/launch.json and wait for the user's verdict
# before doing anything else; if the user wants the test run anyway (now or after
# manual testing), Claude re-issues the exact same command prefixed with
# CLAUDE_LOCAL_TEST_CONFIRMED=1 (inert env var — see the bypass check below),
# which this hook then lets through.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# Bypass once the user has explicitly confirmed the run should proceed.
if [[ "$command" == CLAUDE_LOCAL_TEST_CONFIRMED=1\ * ]]; then
  exit 0
fi

label=""

# A long-running command only counts when it is actually being invoked, i.e. when it starts a
# command segment - not when its name merely occurs somewhere in the line: inside a commit message
# ("git commit -m 'fix pytest detection'"), a file/branch name ("test_pytest_helpers.py",
# "feature/fix-pytest-run") or the argument of a read-only command
# ("sed -n 1,5p scripts/run_integration_tests.sh"). A "segment" is whatever sits between shell
# command separators (&&, ;, |); an env-var assignment (FOO=bar pytest ...) may precede the
# command within the same segment, and for the scripts and vitest also an interpreter/runner
# (bash, sh, npx, npm exec) and a path (./scripts/, scripts/).
ENV_PREFIX='([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*'
RUNNER_PREFIX="${ENV_PREFIX}"'((bash|sh|npx|npm[[:space:]]+exec)[[:space:]]+)?([^[:space:]]*/)?'

# segment_matches REGEX: true if REGEX matches the start of any command segment (leading
# whitespace removed).
segment_matches() {
  local regex=$1 segment trimmed
  while IFS= read -r segment; do
    trimmed="${segment#"${segment%%[![:space:]]*}"}"
    if [[ "$trimmed" =~ $regex ]]; then
      return 0
    fi
  done <<< "$(printf '%s' "$command" | sed -E 's/(&&|\;|\|)/\n/g')"
  return 1
}

pytest_invoked=false
if segment_matches "^${ENV_PREFIX}"'pytest([[:space:]]|$)'; then
  pytest_invoked=true
fi

if segment_matches "^${RUNNER_PREFIX}"'run_mutation_tests\.sh[[:space:]].*(gate|handlers)'; then
  label="Backend-Mutation-Tests (mutmut, in CI ca. 30 Min, siehe docs/mutation-testing.md)"
elif segment_matches "^${RUNNER_PREFIX}"'run_frontend_mutation_tests\.sh[[:space:]].*gate'; then
  label="Frontend-Mutation-Tests (Stryker, in CI ca. 25-30 Min, lokal einige Minuten, siehe docs/mutation-testing.md)"
elif segment_matches "^${RUNNER_PREFIX}"'run_integration_tests\.sh([[:space:]]|$)'; then
  label="Integration-Tests gegen einen laufenden lokalen Backend-Server"
elif [[ "$pytest_invoked" == true ]] \
  && [[ ! "$command" =~ -o[[:space:]]*addopts= ]] \
  && [[ ! "$command" =~ \.py ]] \
  && [[ ! "$command" =~ :: ]] \
  && [[ ! "$command" =~ (^|[[:space:]])-k([[:space:]]|$) ]]; then
  # backend/pyproject.toml bakes --cov-fail-under=95 into [tool.pytest.ini_options]
  # addopts, so a bare `pytest` (the documented full-suite command, README.md)
  # already runs the full coverage gate without "--cov" ever appearing on the
  # command line. A targeted run always names a file/node-id or a -k filter.
  label="voller Backend-Testlauf inkl. 95%-Coverage-Gate (pytest, addopts in backend/pyproject.toml)"
elif segment_matches "^${RUNNER_PREFIX}"'vitest[[:space:]]+run([[:space:]]|$)' && [[ "$command" =~ --coverage ]]; then
  label="voller Frontend-Coverage-Lauf (vitest --coverage)"
fi

if [[ -n "$label" ]]; then
  reason="Langlaufender Test erkannt: $label. Führe ihn NICHT aus. Frag den Nutzer statt dessen per AskUserQuestion, ob er zuerst lokal testen möchte (Optionen etwa: \"Ja, Backend+Frontend starten\" / \"Nein, Test direkt ausführen\"). Bei Ja: starte die preview_start-Konfigurationen \"backend\" und \"frontend\" aus .claude/launch.json und warte auf die Rückmeldung des Nutzers (zufrieden oder nicht) - tu sonst nichts weiter. Sobald der Nutzer zugestimmt hat, DIESEN Testlauf jetzt auszuführen (direkt oder nach dem manuellen Test), wiederhole exakt den ursprünglichen Bash-Befehl mit vorangestelltem 'CLAUDE_LOCAL_TEST_CONFIRMED=1 '."
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
fi

exit 0

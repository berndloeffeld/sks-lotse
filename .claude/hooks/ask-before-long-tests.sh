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

# True only when "pytest" starts a command segment (i.e. it's actually being
# invoked), not when the word merely occurs somewhere in the line - e.g. inside
# a commit message ("git commit -m 'fix pytest detection'") or a file/branch
# name ("test_pytest_helpers.py", "feature/fix-pytest-run"). A "segment" is
# whatever sits between shell command separators (&&, ;, |); an env-var
# assignment (FOO=bar pytest ...) may precede pytest within the same segment.
pytest_invoked=false
while IFS= read -r segment; do
  trimmed="${segment#"${segment%%[![:space:]]*}"}"
  if [[ "$trimmed" =~ ^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*pytest([[:space:]]|$) ]]; then
    pytest_invoked=true
  fi
done <<< "$(printf '%s' "$command" | sed -E 's/(&&|\;|\|)/\n/g')"

if [[ "$command" =~ run_mutation_tests\.sh.*(gate|handlers) ]]; then
  label="Backend-Mutation-Tests (mutmut, ~5 Min)"
elif [[ "$command" =~ run_frontend_mutation_tests\.sh.*gate ]]; then
  label="Frontend-Mutation-Tests (Stryker, ~3 Min)"
elif [[ "$command" =~ run_integration_tests\.sh ]]; then
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
elif [[ "$command" =~ vitest[[:space:]]+run ]] && [[ "$command" =~ --coverage ]]; then
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

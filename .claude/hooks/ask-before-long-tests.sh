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

if [[ "$command" =~ run_mutation_tests\.sh.*(gate|handlers) ]]; then
  label="Backend-Mutation-Tests (mutmut, ~5 Min)"
elif [[ "$command" =~ run_frontend_mutation_tests\.sh.*gate ]]; then
  label="Frontend-Mutation-Tests (Stryker, ~3 Min)"
elif [[ "$command" =~ run_integration_tests\.sh ]]; then
  label="Integration-Tests gegen einen laufenden lokalen Backend-Server"
elif [[ "$command" =~ pytest ]] && [[ "$command" =~ --cov ]]; then
  label="voller Backend-Coverage-Lauf (pytest --cov)"
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

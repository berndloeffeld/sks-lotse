import type { SbfNavigationAiSuggestion, SbfNavigationAttempt, SbfNavigationTaskSummary } from './api/types'
import type { NavigationRunState } from './navigationRun'

// A saved run (ADR-0071) as the page's run state: the server keeps the answers and points, the page
// shows them the same way as a guest's run (navigationRun.ts).
export function attemptToRunState(attempt: SbfNavigationAttempt): NavigationRunState {
  return {
    answers: Object.fromEntries(
      attempt.subtasks.map((subtask) => [
        subtask.number,
        { answer: subtask.answer_text, point: subtask.point === null ? null : subtask.point === 1 ? 1 : 0 },
      ]),
    ),
  }
}

// What the Lotsen-Check may do for a subtask of the run: whether it can look at it at all, and its
// suggestion once given.
export interface SubtaskCheck {
  checkable: boolean
  suggestion: SbfNavigationAiSuggestion | null
}

export function subtaskCheck(attempt: SbfNavigationAttempt, number: number): SubtaskCheck | null {
  const subtask = attempt.subtasks.find((row) => row.number === number)
  return subtask ? { checkable: subtask.ai_checkable, suggestion: subtask.ai_suggestion ?? null } : null
}

// The line on a task's card in the overview: the open run and how far it got, else the latest result.
export function summaryLine(
  summary: SbfNavigationTaskSummary,
  subtaskCount: number,
  passPoints: number,
): string | null {
  if (summary.open_attempt_id !== null) {
    return `Offen · ${summary.open_answered ?? 0}/${subtaskCount} · fortsetzen`
  }
  if (summary.last_points !== null && summary.last_points !== undefined) {
    const verdict = summary.last_points >= passPoints ? 'bestanden' : 'nicht bestanden'
    return `Zuletzt ${summary.last_points}/${subtaskCount} · ${verdict}`
  }
  return null
}

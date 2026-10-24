import { runVerdict, type RunVerdict } from '../runVerdict'
import { taskMaxPoints, type NavigationTask } from './navigationCatalog'

// A guest's run through a Navigationsaufgabe (ADR-0068), kept only in the page: the subtasks strictly
// in order, a subtask's official result only once it is answered, then the guest's own grade (1 point
// or none: a mistake that only follows from an earlier one still counts, SpFV Anlage 3 Nr. 1.1), then
// the next subtask.

export interface NavigationAnswer {
  answer: string
  point: 0 | 1 | null
}

export interface NavigationRunState {
  answers: Record<number, NavigationAnswer>
}

export function startNavigationRun(): NavigationRunState {
  return { answers: {} }
}

// The first subtask without a grade yet — answered or not; null once every subtask has one.
export function currentSubtask(task: NavigationTask, run: NavigationRunState): number | null {
  const next = task.subtasks.find((subtask) => run.answers[subtask.number]?.point == null)
  return next ? next.number : null
}

export function isRunInProgress(task: NavigationTask, run: NavigationRunState): boolean {
  return currentSubtask(task, run) !== null && Object.keys(run.answers).length > 0
}

function requireCurrent(task: NavigationTask, run: NavigationRunState, subtask: number) {
  if (currentSubtask(task, run) !== subtask) throw new Error('Only the current subtask can be worked on')
}

// The answer to the current subtask — once: its official result is shown right after.
export function answerSubtask(
  task: NavigationTask,
  run: NavigationRunState,
  subtask: number,
  answer: string,
): NavigationRunState {
  requireCurrent(task, run, subtask)
  if (run.answers[subtask]) throw new Error('The subtask is already answered')
  return { answers: { ...run.answers, [subtask]: { answer, point: null } } }
}

export function gradeSubtask(
  task: NavigationTask,
  run: NavigationRunState,
  subtask: number,
  correct: boolean,
): NavigationRunState {
  requireCurrent(task, run, subtask)
  const answer = run.answers[subtask]
  if (!answer) throw new Error('Answer the subtask first')
  return { answers: { ...run.answers, [subtask]: { ...answer, point: correct ? 1 : 0 } } }
}

export function runPoints(run: NavigationRunState): number {
  return Object.values(run.answers).reduce((sum, answer) => sum + (answer.point ?? 0), 0)
}

export interface NavigationResult extends RunVerdict {
  points: number
  max: number
}

// The evaluation once every subtask is graded, by the Bewertungsschlüssel's threshold; null before.
export function navigationResult(
  task: NavigationTask,
  run: NavigationRunState,
  passPoints: number,
): NavigationResult | null {
  if (currentSubtask(task, run) !== null) return null
  const points = runPoints(run)
  return { points, max: taskMaxPoints(task), ...runVerdict(points, passPoints) }
}

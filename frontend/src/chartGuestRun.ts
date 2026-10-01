import type { ChartAttempt, ChartAttemptTask } from './api/types'
import { sheetMaxPoints, type ChartSheet, type ChartSheetTask } from './chartCatalog'

// A guest's run through a Kartenaufgabe (ADR-0056), kept only in the page: the same rules the API
// enforces for a learner's run (backend/app/services/chart_exercises.py) — tasks strictly in order,
// a task's solution only once it is answered, then the guest's own points, then the next task. It
// is shaped like the API's run (ChartAttempt), so the run's components show it unchanged.

export interface GuestAnswer {
  answer_text: string
  points_awarded: number | null
}

export interface GuestRun {
  startedAt: string
  completedAt: string | null
  answers: Record<number, GuestAnswer>
}

export function startGuestRun(now: Date = new Date()): GuestRun {
  return { startedAt: now.toISOString(), completedAt: null, answers: {} }
}

// The first task without points yet — answered or not; null once every task has points.
export function currentTask(sheet: ChartSheet, run: GuestRun): number | null {
  const task = sheet.tasks.find((t) => run.answers[t.number]?.points_awarded == null)
  return task ? task.number : null
}

// Whether the Lotsen-Check could look at the task: not when a drawing (the current triangle) scores,
// as backend/app/services/chart_grader.py decides for a learner's run (ADR-0058).
export function isAiCheckable(task: ChartSheetTask): boolean {
  return !task.solution.some((part) => part.image)
}

// A task as the run shows it: its solution only once answered — or, with `reveal`, always (the
// list of all tasks below a sheet's page).
export function taskView(task: ChartSheetTask, answer?: GuestAnswer, reveal = false): ChartAttemptTask {
  const shown = reveal || answer !== undefined
  return {
    number: task.number,
    max_points: task.points,
    text: task.text,
    questions: task.questions,
    answer_text: answer ? answer.answer_text : null,
    solution: shown ? task.solution : [],
    derivation: shown ? task.derivation : [],
    points_awarded: answer ? answer.points_awarded : null,
    ai_checkable: isAiCheckable(task),
    // A guest's run is never sent anywhere, so the Lotsen-Check only shows as a teaser.
    ai_suggestion: null,
  }
}

export function guestAttempt(sheet: ChartSheet, run: GuestRun): ChartAttempt {
  const current = currentTask(sheet, run)
  const visible = sheet.tasks.filter((task) => current === null || task.number <= current)
  return {
    // Nothing is ever sent for a guest's run; the id only fills the shape.
    id: 0,
    exercise_number: sheet.number,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    task_count: sheet.tasks.length,
    max_points: sheetMaxPoints(sheet),
    points: Object.values(run.answers).reduce((sum, answer) => sum + (answer.points_awarded ?? 0), 0),
    current_task: current,
    tasks: visible.map((task) => taskView(task, run.answers[task.number])),
  }
}

function requireCurrent(sheet: ChartSheet, run: GuestRun, taskNumber: number): ChartSheetTask {
  const task = sheet.tasks.find((t) => t.number === taskNumber)
  if (!task) throw new Error(`No task ${taskNumber}`)
  if (currentTask(sheet, run) !== taskNumber) throw new Error('Only the current task can be worked on')
  return task
}

// The answer to the current task — once: the solution is shown right after.
export function answerTask(sheet: ChartSheet, run: GuestRun, taskNumber: number, answerText: string): GuestRun {
  requireCurrent(sheet, run, taskNumber)
  if (run.answers[taskNumber]) throw new Error('The task is already answered')
  return { ...run, answers: { ...run.answers, [taskNumber]: { answer_text: answerText, points_awarded: null } } }
}

// The guest's own points for the answered current task; the last one completes the run.
export function awardPoints(
  sheet: ChartSheet,
  run: GuestRun,
  taskNumber: number,
  points: number,
  now: Date = new Date(),
): GuestRun {
  const task = requireCurrent(sheet, run, taskNumber)
  const answer = run.answers[taskNumber]
  if (!answer) throw new Error('Answer the task first')
  if (points < 0 || points > task.points) throw new Error(`At most ${task.points} points`)
  const next = { ...run, answers: { ...run.answers, [taskNumber]: { ...answer, points_awarded: points } } }
  return currentTask(sheet, next) === null ? { ...next, completedAt: now.toISOString() } : next
}

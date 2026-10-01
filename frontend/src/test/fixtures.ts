import type { ChartAttempt, ChartAttemptTask, ChartExercisesOverview, Exam, ExamQuestion, User } from '../api/types'
import type { ChartExport } from '../chartCatalog'

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

export function examQuestion(position: number, overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    position,
    subject_group: 'navigation',
    question_id: position,
    subject: 'navigation',
    number: position,
    question_text: `Frage ${position}?`,
    question_images: [],
    answer_text: null,
    official_answer: null,
    official_answer_images: [],
    outcome: null,
    points: null,
    ...overrides,
  }
}

export function makeExam(overrides: Partial<Exam> = {}): Exam {
  const now = Date.now()
  return {
    id: 7,
    status: 'in_progress',
    exam_variant: 'motor',
    started_at: new Date(now).toISOString(),
    deadline_at: new Date(now + 90 * 60 * 1000).toISOString(),
    server_now: new Date(now).toISOString(),
    submitted_at: null,
    timed_out: false,
    answered_count: 0,
    question_count: 2,
    points: null,
    max_points: 60,
    result: null,
    group_scores: null,
    questions: [examQuestion(1), examQuestion(2, { subject_group: 'wetterkunde' })],
    ...overrides,
  }
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'learner@example.com',
    created_at: '2026-01-01T00:00:00Z',
    exam_variant: null,
    first_name: null,
    last_name: null,
    gender: null,
    is_admin: false,
    can_buy_tokens: false,
    can_use_chart_exercises: false,
    token_balance: 0,
    ads_removed: false,
    agb_accepted_version: null,
    ...overrides,
  }
}

// Records which element had focus the moment `text` first appeared in the document. Call it before
// rendering and read the result once the text is there: a screen that places the cursor in an effect
// shows up briefly without it, which a plain toHaveFocus() after findBy… only catches by timing.
export function focusWhenShown(text: string): () => Element | null | undefined {
  let focused: Element | null | undefined
  const observer = new MutationObserver(() => {
    if (focused === undefined && document.body.textContent?.includes(text)) focused = document.activeElement
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => {
    observer.disconnect()
    return focused
  }
}

export function chartTask(number: number, overrides: Partial<ChartAttemptTask> = {}): ChartAttemptTask {
  return {
    number,
    max_points: 2,
    text: `Lage ${number}.`,
    questions: [
      { points: 1, text: `Frage ${number}a?` },
      { points: 1, text: `Frage ${number}b?` },
    ],
    answer_text: null,
    solution: [],
    derivation: [],
    points_awarded: null,
    ai_checkable: true,
    ai_suggestion: null,
    ...overrides,
  }
}

export function makeChartAttempt(overrides: Partial<ChartAttempt> = {}): ChartAttempt {
  return {
    id: 5,
    exercise_number: 3,
    started_at: '2026-09-30T10:00:00Z',
    completed_at: null,
    task_count: 2,
    max_points: 4,
    points: 0,
    current_task: 1,
    tasks: [chartTask(1)],
    ...overrides,
  }
}

export function makeChartOverview(overrides: Partial<ChartExercisesOverview> = {}): ChartExercisesOverview {
  return {
    source: 'WSV, Navigationsaufgaben SKS',
    hints: ['Erlaubte Hilfsmittel: Übungskarte 49.', 'Hinweise: Kurse auf volle Grade runden.'],
    tide_form: { src: 'formblatt-gezeiten.png', width: 1428, height: 1667 },
    exercises: [
      { number: 1, task_count: 18, max_points: 30, open_attempt_id: null, completed_count: 0, last_points: null },
      { number: 2, task_count: 18, max_points: 30, open_attempt_id: 9, completed_count: 0, last_points: null },
      { number: 3, task_count: 18, max_points: 30, open_attempt_id: null, completed_count: 2, last_points: 24 },
    ],
    ...overrides,
  }
}

// The Kartenaufgaben export guests get (chartCatalog.ts): two sheets, the first with two tasks.
export function makeChartExport(overrides: Partial<ChartExport> = {}): ChartExport {
  const task = (number: number, points: number) => ({
    number,
    points,
    text: `Szenario ${number}`,
    questions: [{ points, text: `Frage ${number}` }],
    solution: [{ results: [{ text: `Ergebnis ${number}`, tolerance: '[± 1°]' }], image: null }],
    derivation: [{ text: `Herleitung ${number}`, table: null }],
  })
  return {
    source: 'WSV, Navigationsaufgaben SKS',
    hints: ['Erlaubte Hilfsmittel: Übungskarte 49.'],
    tide_form: { src: 'formblatt-gezeiten.png', width: 1428, height: 1667 },
    sheets: [
      { number: 1, tasks: [task(1, 2), task(2, 1)] },
      { number: 2, tasks: [task(1, 3)] },
    ],
    ...overrides,
  }
}

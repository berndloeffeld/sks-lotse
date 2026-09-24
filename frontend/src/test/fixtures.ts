import type { Exam, ExamQuestion, User } from '../api/types'

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

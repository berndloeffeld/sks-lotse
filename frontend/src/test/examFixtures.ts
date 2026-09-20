import type { Exam, ExamQuestion } from '../api/types'

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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

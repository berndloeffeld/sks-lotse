import { describe, expect, it } from 'vitest'

import type { SbfNavigationAttempt, SbfNavigationTaskSummary } from './api/types'
import { attemptToRunState, subtaskCheck, summaryLine } from './savedRun'

function attempt(subtasks: SbfNavigationAttempt['subtasks']): SbfNavigationAttempt {
  return {
    id: 7,
    task_number: 1,
    started_at: '2026-10-24T10:00:00Z',
    completed_at: null,
    subtask_count: 9,
    points: 0,
    current_subtask: 1,
    subtasks,
  }
}

const SUGGESTION = { correct: false, feedback: 'Der MgK weicht ab.', suspected_error: 'Mw addiert.' }

describe('attemptToRunState', () => {
  it('turns the stored answers and points into the page’s run state', () => {
    const state = attemptToRunState(
      attempt([
        { number: 1, answer_text: 'rwK 079°', point: 1, ai_checkable: true, ai_suggestion: null },
        { number: 2, answer_text: 'MgK 080°', point: 0, ai_checkable: true, ai_suggestion: SUGGESTION },
        { number: 3, answer_text: '', point: null, ai_checkable: false, ai_suggestion: null },
      ]),
    )
    expect(state).toEqual({
      answers: {
        1: { answer: 'rwK 079°', point: 1 },
        2: { answer: 'MgK 080°', point: 0 },
        3: { answer: '', point: null },
      },
    })
  })

  it('starts empty for a fresh run', () => {
    expect(attemptToRunState(attempt([]))).toEqual({ answers: {} })
  })
})

describe('subtaskCheck', () => {
  it('says whether the check can look at a subtask, and its suggestion once given', () => {
    const run = attempt([
      { number: 1, answer_text: 'x', point: null, ai_checkable: true, ai_suggestion: SUGGESTION },
      { number: 2, answer_text: 'y', point: null, ai_checkable: false, ai_suggestion: null },
    ])
    expect(subtaskCheck(run, 1)).toEqual({ checkable: true, suggestion: SUGGESTION })
    expect(subtaskCheck(run, 2)).toEqual({ checkable: false, suggestion: null })
    expect(subtaskCheck(run, 3)).toBeNull()
  })
})

describe('summaryLine', () => {
  const base: SbfNavigationTaskSummary = {
    number: 1,
    open_attempt_id: null,
    open_answered: null,
    completed_count: 0,
    last_points: null,
    last_completed_at: null,
  }

  it('names the open run and how far it got', () => {
    expect(summaryLine({ ...base, open_attempt_id: 3, open_answered: 4 }, 9, 7)).toBe('Offen · 4/9 · fortsetzen')
    expect(summaryLine({ ...base, open_attempt_id: 3, open_answered: null }, 9, 7)).toBe('Offen · 0/9 · fortsetzen')
  })

  it('names the latest result by the pass mark, exactly at it passed', () => {
    expect(summaryLine({ ...base, completed_count: 1, last_points: 7 }, 9, 7)).toBe('Zuletzt 7/9 · bestanden')
    expect(summaryLine({ ...base, completed_count: 1, last_points: 6 }, 9, 7)).toBe('Zuletzt 6/9 · nicht bestanden')
    expect(summaryLine({ ...base, completed_count: 1, last_points: 0 }, 9, 7)).toBe('Zuletzt 0/9 · nicht bestanden')
  })

  it('says nothing for a task never worked on', () => {
    expect(summaryLine(base, 9, 7)).toBeNull()
  })
})

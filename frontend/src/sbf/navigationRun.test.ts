import { describe, expect, it } from 'vitest'

import { navigationTaskFixture } from './navigationFixture'
import {
  answerSubtask,
  currentSubtask,
  gradeSubtask,
  isRunInProgress,
  navigationResult,
  runPoints,
  startNavigationRun,
} from './navigationRun'

const task = navigationTaskFixture()

function graded(...points: boolean[]) {
  let run = startNavigationRun()
  points.forEach((correct, i) => {
    run = answerSubtask(task, run, i + 1, `Antwort ${i + 1}`)
    run = gradeSubtask(task, run, i + 1, correct)
  })
  return run
}

describe('navigationRun', () => {
  it('works through the subtasks in order', () => {
    let run = startNavigationRun()
    expect(currentSubtask(task, run)).toBe(1)
    expect(isRunInProgress(task, run)).toBe(false)
    run = answerSubtask(task, run, 1, '079°')
    expect(run.answers[1]).toEqual({ answer: '079°', point: null })
    expect(currentSubtask(task, run)).toBe(1)
    expect(isRunInProgress(task, run)).toBe(true)
    run = gradeSubtask(task, run, 1, true)
    expect(currentSubtask(task, run)).toBe(2)
  })

  it('refuses a subtask out of order, a second answer and a grade before the answer', () => {
    const run = startNavigationRun()
    expect(() => answerSubtask(task, run, 2, 'x')).toThrow('Only the current subtask')
    const answered = answerSubtask(task, run, 1, 'x')
    expect(() => answerSubtask(task, answered, 1, 'y')).toThrow('already answered')
    expect(() => gradeSubtask(task, run, 1, true)).toThrow('Answer the subtask first')
    expect(() => gradeSubtask(task, answered, 2, true)).toThrow('Only the current subtask')
  })

  it('gives one point per correct subtask', () => {
    expect(runPoints(graded(true, false))).toBe(1)
    expect(graded(true, false).answers[2].point).toBe(0)
  })

  it('evaluates only once every subtask is graded', () => {
    expect(navigationResult(task, graded(true, true), 2)).toBeNull()
    const done = graded(true, true, false)
    expect(currentSubtask(task, done)).toBeNull()
    expect(isRunInProgress(task, done)).toBe(false)
    expect(navigationResult(task, done, 2)).toEqual({ points: 2, max: 3, passed: true, missing: 0 })
    expect(navigationResult(task, graded(true, false, false), 2)).toEqual({
      points: 1,
      max: 3,
      passed: false,
      missing: 1,
    })
  })
})

import { describe, expect, it } from 'vitest'

import { answerTask, awardPoints, currentTask, guestAttempt, startGuestRun, taskView } from './chartGuestRun'
import { makeChartExport } from './test/fixtures'

const SHEET = makeChartExport().sheets[0]
const START = new Date('2026-10-01T10:00:00Z')
const END = new Date('2026-10-01T11:00:00Z')

describe('guest chart run', () => {
  it('starts at the first task, with only it visible and its solution withheld', () => {
    const run = startGuestRun(START)
    const attempt = guestAttempt(SHEET, run)

    expect(run).toEqual({ startedAt: '2026-10-01T10:00:00.000Z', completedAt: null, answers: {} })
    expect(attempt).toMatchObject({
      id: 0,
      exercise_number: 1,
      started_at: '2026-10-01T10:00:00.000Z',
      completed_at: null,
      task_count: 2,
      max_points: 3,
      points: 0,
      current_task: 1,
    })
    expect(attempt.tasks).toHaveLength(1)
    expect(attempt.tasks[0]).toMatchObject({ number: 1, answer_text: null, solution: [], derivation: [] })
  })

  it('shows the solution once answered and moves on once points are given', () => {
    let run = answerTask(SHEET, startGuestRun(START), 1, '  HW 12:30 ')
    let attempt = guestAttempt(SHEET, run)
    expect(attempt.current_task).toBe(1)
    expect(attempt.tasks[0]).toMatchObject({ answer_text: '  HW 12:30 ', points_awarded: null })
    expect(attempt.tasks[0].solution).toEqual(SHEET.tasks[0].solution)
    expect(attempt.tasks[0].derivation).toEqual(SHEET.tasks[0].derivation)

    run = awardPoints(SHEET, run, 1, 2, END)
    attempt = guestAttempt(SHEET, run)
    expect(run.completedAt).toBeNull()
    expect(attempt.current_task).toBe(2)
    expect(attempt.points).toBe(2)
    expect(attempt.tasks.map((t) => t.number)).toEqual([1, 2])
    expect(attempt.tasks[1].solution).toEqual([])
  })

  it('completes with the last task’s points, every task then visible', () => {
    let run = startGuestRun(START)
    run = awardPoints(SHEET, answerTask(SHEET, run, 1, 'a'), 1, 0, END)
    run = awardPoints(SHEET, answerTask(SHEET, run, 2, ''), 2, 1, END)
    const attempt = guestAttempt(SHEET, run)

    expect(run.completedAt).toBe('2026-10-01T11:00:00.000Z')
    expect(currentTask(SHEET, run)).toBeNull()
    expect(attempt).toMatchObject({ current_task: null, points: 1, completed_at: '2026-10-01T11:00:00.000Z' })
    expect(attempt.tasks.map((t) => t.points_awarded)).toEqual([0, 1])
  })

  it('refuses work out of order, twice, or beyond the task’s points', () => {
    const run = startGuestRun(START)
    expect(() => answerTask(SHEET, run, 2, 'x')).toThrow('Only the current task can be worked on')
    expect(() => answerTask(SHEET, run, 9, 'x')).toThrow('No task 9')
    expect(() => awardPoints(SHEET, run, 1, 1)).toThrow('Answer the task first')

    const answered = answerTask(SHEET, run, 1, 'x')
    expect(() => answerTask(SHEET, answered, 1, 'y')).toThrow('The task is already answered')
    expect(() => awardPoints(SHEET, answered, 1, 3)).toThrow('At most 2 points')
    expect(() => awardPoints(SHEET, answered, 1, -1)).toThrow('At most 2 points')
    expect(awardPoints(SHEET, answered, 1, 2).answers[1].points_awarded).toBe(2)
  })

  it('offers the Lotsen-Check except where a drawing scores', () => {
    const task = SHEET.tasks[0]
    const drawing = { src: 'dreieck.png', width: 10, height: 10 }
    expect(taskView(task).ai_checkable).toBe(true)
    expect(taskView({ ...task, solution: [...task.solution, { results: [], image: drawing }] }).ai_checkable).toBe(
      false,
    )
  })

  it('reveals a task’s solution on request, without an answer', () => {
    const task = SHEET.tasks[1]
    expect(taskView(task)).toMatchObject({ number: 2, max_points: 1, solution: [], derivation: [], answer_text: null })
    expect(taskView(task, undefined, true)).toMatchObject({
      solution: task.solution,
      derivation: task.derivation,
      answer_text: null,
      points_awarded: null,
    })
  })
})

import { describe, expect, it } from 'vitest'

import { dayFromNumber, localDayNumber, tickStep, timeAxis } from './chartTimeline'

const at = (iso: string) => ({ completed_at: iso })
const completedAt = (run: { completed_at: string }) => run.completed_at

describe('localDayNumber', () => {
  it('counts calendar days, whatever the time of day', () => {
    expect(localDayNumber(new Date(2026, 9, 2, 23, 59))).toBe(localDayNumber(new Date(2026, 9, 1, 0, 0)) + 1)
  })

  it('keeps one step per day across the DST switch', () => {
    expect(localDayNumber(new Date(2026, 9, 26, 12))).toBe(localDayNumber(new Date(2026, 9, 24, 12)) + 2)
  })

  it('round-trips through dayFromNumber', () => {
    const day = dayFromNumber(localDayNumber(new Date(2026, 9, 25, 18)))
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([2026, 9, 25, 0])
  })
})

describe('tickStep', () => {
  it.each([
    [1, 1],
    [6, 1],
    [7, 2],
    [12, 2],
    [13, 7],
    [42, 7],
    [43, 14],
    [84, 14],
    [85, 28],
    [168, 28],
    [169, 29],
  ])('labels %i days every %i days', (days, step) => {
    expect(tickStep(days)).toBe(step)
  })
})

describe('timeAxis', () => {
  const today = new Date(2026, 9, 31, 20)

  it('runs from the first run to today, one slot per day with a run', () => {
    const runs = [at(new Date(2026, 9, 21, 18).toISOString()), at(new Date(2026, 9, 28, 9).toISOString())]
    const axis = timeAxis(runs, completedAt, today)
    expect(axis.firstDay).toBe(localDayNumber(new Date(2026, 9, 21)))
    expect(axis.dayCount).toBe(11)
    expect(axis.slots).toEqual([
      { offset: 0, runs: [runs[0]] },
      { offset: 7, runs: [runs[1]] },
    ])
    expect(axis.ticks).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('counts the ticks back from today', () => {
    const axis = timeAxis([at(new Date(2026, 9, 20, 9).toISOString())], completedAt, today)
    expect(axis.dayCount).toBe(12)
    expect(axis.ticks).toEqual([1, 3, 5, 7, 9, 11])
  })

  it('puts runs of the same day into one slot, in their order', () => {
    const morning = at(new Date(2026, 9, 30, 9).toISOString())
    const evening = at(new Date(2026, 9, 30, 21).toISOString())
    const axis = timeAxis([morning, evening], completedAt, today)
    expect(axis.slots).toEqual([{ offset: 0, runs: [morning, evening] }])
    expect(axis.dayCount).toBe(2)
  })

  it('is a single day without runs', () => {
    expect(timeAxis([], completedAt, today)).toEqual({
      firstDay: localDayNumber(today),
      dayCount: 1,
      slots: [],
      ticks: [0],
    })
  })
})

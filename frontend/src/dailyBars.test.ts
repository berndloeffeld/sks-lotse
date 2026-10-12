import { describe, expect, it } from 'vitest'

import { barHeight, formatDay, seriesMax, seriesSum, stackTotals } from './dailyBars'

describe('dailyBars', () => {
  it('finds the highest value, 0 for an empty or all-zero series', () => {
    expect(seriesMax([3, 9, 4])).toBe(9)
    expect(seriesMax([])).toBe(0)
    expect(seriesMax([0, 0])).toBe(0)
  })

  it('sums a series', () => {
    expect(seriesSum([1, 2, 3])).toBe(6)
    expect(seriesSum([])).toBe(0)
  })

  it('scales a bar to the tallest one and never divides by zero', () => {
    expect(barHeight(5, 10, 60)).toBe(30)
    expect(barHeight(10, 10, 60)).toBe(60)
    expect(barHeight(0, 10, 60)).toBe(0)
    expect(barHeight(0, 0, 60)).toBe(0)
  })

  it('adds stacked series day by day', () => {
    expect(
      stackTotals([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([4, 6])
    expect(stackTotals([[5, 0, 7]])).toEqual([5, 0, 7])
    expect(stackTotals([])).toEqual([])
  })

  it('formats a UTC day as day and month', () => {
    expect(formatDay('2026-10-12')).toBe('12.10.')
    expect(formatDay('2026-01-01')).toBe('01.01.')
  })
})

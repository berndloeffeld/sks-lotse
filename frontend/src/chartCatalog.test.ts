import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  chartCatalogSnapshot,
  chartExercisesForGuests,
  guestOverview,
  loadChartCatalog,
  primeChartCatalog,
  resetChartCatalog,
  sheetMaxPoints,
} from './chartCatalog'
import { makeChartExport } from './test/fixtures'

describe('chartCatalog', () => {
  afterEach(() => resetChartCatalog())

  it('opens the Kartenaufgaben to guests only at "on"', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    expect(chartExercisesForGuests()).toBe(true)
    vi.stubEnv('VITE_CHART_EXERCISES', 'admins')
    expect(chartExercisesForGuests()).toBe(false)
    vi.stubEnv('VITE_CHART_EXERCISES', '')
    expect(chartExercisesForGuests()).toBe(false)
  })

  it('sums a sheet’s points and gives guests the overview without runs', () => {
    const charts = makeChartExport()
    expect(sheetMaxPoints(charts.sheets[0])).toBe(3)
    expect(guestOverview(charts)).toEqual({
      source: charts.source,
      hints: charts.hints,
      tide_form: charts.tide_form,
      exercises: [
        { number: 1, task_count: 2, max_points: 3, open_attempt_id: null, completed_count: 0, last_points: null },
        { number: 2, task_count: 1, max_points: 3, open_attempt_id: null, completed_count: 0, last_points: null },
      ],
    })
  })

  it('has no snapshot until primed or loaded', async () => {
    expect(chartCatalogSnapshot()).toBeNull()
    const primed = primeChartCatalog(makeChartExport())
    expect(chartCatalogSnapshot()).toBe(primed)
    expect(await loadChartCatalog(() => Promise.reject(new Error('not needed')))).toBe(primed)
  })

  it('loads once, shares the pending load, and retries after a failure', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(makeChartExport())

    await expect(loadChartCatalog(load)).rejects.toThrow('offline')
    expect(chartCatalogSnapshot()).toBeNull()

    const [first, second] = await Promise.all([loadChartCatalog(load), loadChartCatalog(load)])
    expect(first).toBe(second)
    expect(load).toHaveBeenCalledTimes(2)
    expect(chartCatalogSnapshot()).toBe(first)
  })

  it('loads the committed export by default', async () => {
    const charts = await loadChartCatalog()
    expect(charts.sheets.length).toBeGreaterThan(0)
    expect(charts.sheets[0].tasks[0].solution.length).toBeGreaterThan(0)
  })
})

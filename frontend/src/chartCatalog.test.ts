import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  chartCatalogSnapshot,
  chartExercisesForGuests,
  guestOverview,
  loadChartCatalog,
  primeChartCatalog,
  resetChartCatalog,
  sheetMaxPoints,
  upcomingChartSheets,
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

  it('lists the sheets still to come, without those whose sheet is in', () => {
    const numbers = (available: number[]) => upcomingChartSheets(available).map((sheet) => sheet.number)
    expect(numbers([1, 2, 3, 4, 5, 6, 7])).toEqual([8, 9, 10])
    expect(numbers([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([9, 10])
    expect(numbers([8, 9, 10])).toEqual([])
    expect(upcomingChartSheets([1])[0]).toEqual({
      number: 8,
      title: 'Großtonne GB → Cuxhaven',
      summary: expect.stringContaining('Nachtfahrt'),
    })
  })

  it('sums a sheet’s points and gives guests the overview without runs', () => {
    const charts = makeChartExport()
    expect(sheetMaxPoints(charts.sheets[0])).toBe(3)
    expect(guestOverview(charts)).toEqual({
      source: charts.source,
      hints: charts.hints,
      tide_form: charts.tide_form,
      exercises: [
        {
          number: 1,
          title: 'Cuxhaven → Büsum',
          summary: 'Elbabwärts durch die Norderrinne.',
          task_count: 2,
          max_points: 3,
          open_attempt_id: null,
          completed_count: 0,
          last_points: null,
        },
        {
          number: 2,
          title: 'Büsum → Helgoland',
          summary: 'Bei Nordwind mit Kreuzpeilung.',
          task_count: 1,
          max_points: 3,
          open_attempt_id: null,
          completed_count: 0,
          last_points: null,
        },
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

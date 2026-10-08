import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { primeChartCatalog, resetChartCatalog } from '../chartCatalog'
import { makeChartExport } from '../test/fixtures'
import { useChartCatalog } from './useChartCatalog'

describe('useChartCatalog', () => {
  afterEach(() => {
    resetChartCatalog()
    vi.doUnmock('../data/chart_exercises.gen.json')
  })

  it('has the export at once when it was primed (a prerendered page)', () => {
    const primed = primeChartCatalog(makeChartExport())
    const { result } = renderHook(() => useChartCatalog())
    expect(result.current).toMatchObject({ charts: primed, failed: false })
  })

  it('loads it on first use otherwise', async () => {
    const { result } = renderHook(() => useChartCatalog())
    expect(result.current.charts).toBeNull()
    await waitFor(() => expect(result.current.charts?.sheets.length).toBeGreaterThan(0))
    expect(result.current.failed).toBe(false)
  })

  it('says so when it cannot be loaded', async () => {
    vi.doMock('../data/chart_exercises.gen.json', () => {
      throw new Error('offline')
    })
    const { result } = renderHook(() => useChartCatalog())
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.charts).toBeNull()
  })
})

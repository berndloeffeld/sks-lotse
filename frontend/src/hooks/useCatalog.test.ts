import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { primeCatalog, resetCatalog, type CatalogExport } from '../catalog'
import { useCatalog } from './useCatalog'

const EXPORT: CatalogExport = { topics: [], questions: [] }

describe('useCatalog', () => {
  afterEach(() => resetCatalog())

  it('has the catalog at once when it was primed (a prerendered page)', () => {
    const primed = primeCatalog(EXPORT)
    const { result } = renderHook(() => useCatalog())
    expect(result.current).toMatchObject({ catalog: primed, failed: false })
  })

  it('loads it on first use otherwise', async () => {
    const { result } = renderHook(() => useCatalog())
    expect(result.current.catalog).toBeNull()
    await waitFor(() => expect(result.current.catalog?.questions.length).toBeGreaterThan(500))
    expect(result.current.failed).toBe(false)
  })
})

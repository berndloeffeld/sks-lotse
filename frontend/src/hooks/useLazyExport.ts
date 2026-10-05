import { useEffect, useState } from 'react'

import type { LazyExport } from '../lazyExport'

// A guest export (lazyExport.ts): there at once on a prerendered page, loaded on first use otherwise.
export function useLazyExport<T, Raw>(source: LazyExport<T, Raw>): { data: T | null; failed: boolean } {
  const [data, setData] = useState(source.snapshot)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (data) return
    let live = true
    source.load().then(
      (loaded) => live && setData(loaded),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [data, source])

  return { data, failed }
}

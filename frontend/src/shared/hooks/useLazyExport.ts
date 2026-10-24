import { useCallback, useEffect, useState } from 'react'

import type { LazyExport } from '../lazyExport'

// A guest export (lazyExport.ts): there at once on a prerendered page, loaded on first use otherwise.
// `reload` asks again after a failed load (a dropped connection while fetching the chunk).
export function useLazyExport<T, Raw>(
  source: LazyExport<T, Raw>,
): { data: T | null; failed: boolean; reload: () => Promise<void> } {
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

  const reload = useCallback(async () => {
    try {
      setData(await source.load())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [source])

  return { data, failed, reload }
}

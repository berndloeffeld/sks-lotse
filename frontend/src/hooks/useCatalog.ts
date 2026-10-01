import { useEffect, useState } from 'react'

import { catalogSnapshot, loadCatalog, type GuestCatalog } from '../catalog'

// The guest catalog (catalog.ts): there at once on a prerendered page, loaded on first use otherwise.
export function useCatalog(): { catalog: GuestCatalog | null; failed: boolean } {
  const [catalog, setCatalog] = useState(catalogSnapshot)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (catalog) return
    let live = true
    loadCatalog().then(
      (loaded) => live && setCatalog(loaded),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [catalog])

  return { catalog, failed }
}

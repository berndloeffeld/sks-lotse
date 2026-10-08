import { catalogSource, type GuestCatalog } from '../catalog'
import { useLazyExport } from './useLazyExport'

// The guest catalog (catalog.ts): there at once on a prerendered page, loaded on first use otherwise.
export function useCatalog(): {
  catalog: GuestCatalog | null
  failed: boolean
  reload: () => Promise<void>
} {
  const { data, failed, reload } = useLazyExport(catalogSource)
  return { catalog: data, failed, reload }
}

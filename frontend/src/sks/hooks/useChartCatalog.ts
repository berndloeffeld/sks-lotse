import { chartCatalogSource, type ChartExport } from '../chartCatalog'
import { useLazyExport } from './useLazyExport'

// The Kartenaufgaben export (chartCatalog.ts): there at once on a prerendered page, loaded on first use otherwise.
export function useChartCatalog(): {
  charts: ChartExport | null
  failed: boolean
  reload: () => Promise<void>
} {
  const { data, failed, reload } = useLazyExport(chartCatalogSource)
  return { charts: data, failed, reload }
}

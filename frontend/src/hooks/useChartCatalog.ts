import { useEffect, useState } from 'react'

import { chartCatalogSnapshot, loadChartCatalog, type ChartExport } from '../chartCatalog'

// The Kartenaufgaben export (chartCatalog.ts): there at once on a prerendered page, loaded on first use otherwise.
export function useChartCatalog(): { charts: ChartExport | null; failed: boolean } {
  const [charts, setCharts] = useState(chartCatalogSnapshot)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (charts) return
    let live = true
    loadChartCatalog().then(
      (loaded) => live && setCharts(loaded),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [charts])

  return { charts, failed }
}

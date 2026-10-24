import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import { appRoutes } from './appRoutes'
import { primeCatalog, type CatalogExport } from './catalog'
import { chartExercisesForGuests, primeChartCatalog, type ChartExport } from './chartCatalog'
import catalogExport from './data/catalog.gen.json'
import chartExport from './data/chart_exercises.gen.json'
import { applyMeta, sitemapXml as sitemapFor, type PublicPage } from '../shared/publicPages'
import { SITE, publicPages } from './publicPages'

// The open /learn pages render from the catalog export (ADR-0054), here as on the client before it
// hydrates them.
const catalog = catalogExport as unknown as CatalogExport
primeCatalog(catalog)
// The /charts pages, from the Kartenaufgaben export, only while they are open to guests (ADR-0056).
const charts = chartExercisesForGuests() ? primeChartCatalog(chartExport as unknown as ChartExport) : null

// For scripts/prerender.mjs: what to render, and how to finish each page's head.
export const pages = publicPages(catalog, charts)
export { applyMeta }
export const sitemapXml = (list: PublicPage[]) => sitemapFor(list, SITE)
// The title of app.html, the shell every path without a page of its own gets.
export const appTitle = 'SKS Lotse'
// The pages under `path` hydrate from the data chunk `chunk` (main.tsx), so they preload it.
export const dataChunks = [
  { path: '/learn', chunk: 'catalog.gen' },
  { path: '/charts', chunk: 'chart_exercises.gen' },
]

// Build-time prerender (ADR-0025): scripts/prerender.mjs calls this once per
// public route and writes the HTML into dist/, so crawlers and link previews
// see real content instead of an empty #root. Renders the logged-out state —
// the same state the client's first render starts from (authStore.isLoading
// until checkSession resolves), so hydration matches. A memory data router, not a StaticRouter:
// it renders the same tree as the client's RouterProvider, so useId gives the same ids on both
// sides (ADR-0059); no route loads data, so it is ready at once and the render stays synchronous.
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [url] })} />
    </StrictMode>,
  )
}

import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'

import { AppRoutes } from './App'
import { primeCatalog, type CatalogExport } from './catalog'
import catalogExport from './data/catalog.gen.json'
import { applyMeta, publicPages, sitemapXml } from './publicPages'

// The open /learn pages render from the catalog export (ADR-0054), here as on the client before it
// hydrates them.
const catalog = catalogExport as unknown as CatalogExport
primeCatalog(catalog)

// For scripts/prerender.mjs: what to render, and how to finish each page's head.
export const pages = publicPages(catalog)
export { applyMeta, sitemapXml }

// Build-time prerender (ADR-0025): scripts/prerender.mjs calls this once per
// public route and writes the HTML into dist/, so crawlers and link previews
// see real content instead of an empty #root. Renders the logged-out state —
// the same state the client's first render starts from (authStore.isLoading
// until checkSession resolves), so hydration matches.
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  )
}

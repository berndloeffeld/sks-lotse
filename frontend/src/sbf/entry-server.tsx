import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import { applyMeta, sitemapXml as sitemapFor, type PublicPage } from '../publicPages'
import { SBF_ORIGIN, sbfPublicPages } from './publicPages'
import { sbfRoutes } from './routes'

// The SBF build's prerender (ADR-0025, ADR-0067), what ../entry-server.tsx is for SKS Lotse:
// scripts/prerender.mjs renders each page into dist/ and writes the sitemap for sbf-lotse.de.
export const pages = sbfPublicPages()
export { applyMeta }
export const sitemapXml = (list: PublicPage[]) => sitemapFor(list, SBF_ORIGIN)
export const appTitle = 'SBF Lotse'
// No page hydrates from a data chunk yet.
export const dataChunks: { path: string; chunk: string }[] = []

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <RouterProvider router={createMemoryRouter(sbfRoutes, { initialEntries: [url] })} />
    </StrictMode>,
  )
}

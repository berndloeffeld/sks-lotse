import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import navigationExport from './data/sbf_navigation.gen.json'
import { applyMeta, sitemapXml as sitemapFor, type PublicPage } from '../shared/publicPages'
import { sbfNavigationOpen } from '../shared/siteConfig'
import { navigationSource, type NavigationExport } from './navigationCatalog'
import { SBF_ORIGIN, sbfPublicPages } from './publicPages'
import { sbfRoutes } from './routes'

// The SBF build's prerender (ADR-0025, ADR-0067), what ../sks/entry-server.tsx is for SKS Lotse:
// scripts/prerender.mjs renders each page into dist/ and writes the sitemap for sbf-lotse.de.
// The Navigationsaufgaben's pages render from the export, here as on the client before it hydrates
// them — only in a build with VITE_SBF=on (ADR-0068). This is the SSR build, deleted after the
// prerender, so the static import puts nothing into what is served.
const navigation = sbfNavigationOpen() ? navigationSource.prime(navigationExport as unknown as NavigationExport) : null
export const pages = sbfPublicPages(navigation)
export { applyMeta }
export const sitemapXml = (list: PublicPage[]) => sitemapFor(list, SBF_ORIGIN)
export const appTitle = 'SBF Lotse'
// The /navigation pages hydrate from the export's chunk (main.tsx), so they preload it.
export const dataChunks: { path: string; chunk: string }[] = navigation
  ? [{ path: '/navigation', chunk: 'sbf_navigation.gen' }]
  : []

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <RouterProvider router={createMemoryRouter(sbfRoutes, { initialEntries: [url] })} />
    </StrictMode>,
  )
}

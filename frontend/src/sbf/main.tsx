import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
// Self-hosted web fonts (ADR-0021), the same as SKS Lotse's (../main.tsx).
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/400-italic.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '../shared/index.css'
import { initAnalytics } from '../shared/analytics'
import { navigationSource } from './navigationCatalog'
import { sbfRoutes } from './routes'

// The SBF build's entry (index.sbf.html, ADR-0067). Like ../main.tsx, it hydrates a prerendered page
// only when the markup belongs to the route it is showing, and otherwise renders afresh.
initAnalytics()

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <RouterProvider router={createBrowserRouter(sbfRoutes)} />
  </StrictMode>
)

const path = window.location.pathname.replace(/(.)\/$/, '$1')
// The prerender knows no query: /navigation/3?run=1 starts the run, which the prerendered task page
// (/navigation/3) doesn't show, so such a page is rendered afresh rather than hydrated.
if (container.hasChildNodes() && container.dataset.prerendered === path && !window.location.search) {
  // The /navigation pages were rendered from the export (ADR-0068); the first render needs it too, or
  // it wouldn't match. If it fails to load, render afresh rather than not at all.
  if (path.startsWith('/navigation')) {
    navigationSource.load().then(
      () => hydrateRoot(container, app),
      () => {
        container.replaceChildren()
        createRoot(container).render(app)
      },
    )
  } else {
    hydrateRoot(container, app)
  }
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}

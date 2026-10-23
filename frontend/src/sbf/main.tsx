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
import '../index.css'
import { initAnalytics } from '../analytics'
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
if (container.hasChildNodes() && container.dataset.prerendered === path) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}

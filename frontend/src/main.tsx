import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// Self-hosted web fonts (ADR-0021): bundled by Vite and served from our own
// origin — never fetched from Google Fonts, which would hand every visitor's
// IP address to Google. Only the weights/styles the design system uses.
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/400-italic.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import App from './App.tsx'
import { openConsentSettingsIfRequested } from './ads.ts'
import { initAnalytics } from './analytics.ts'

initAnalytics()
// Arriving from "Cookies" (footer) on a page without the consent API (ads.ts).
openConsentSettingsIfRequested()

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// The public pages are prerendered (ADR-0025), each tagged with the path it
// was rendered for; every other route is served the empty app.html shell. Only
// hydrate when the markup actually belongs to this route — e.g. `vite preview`
// falls back to index.html for /learn too — otherwise start from a clean
// container.
const path = window.location.pathname.replace(/(.)\/$/, '$1')
if (container.hasChildNodes() && container.dataset.prerendered === path) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
import { initAnalytics } from './analytics.ts'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

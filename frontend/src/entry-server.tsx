import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'

import { AppRoutes } from './App'

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

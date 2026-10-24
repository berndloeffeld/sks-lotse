import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// The title of the home page, as index.html has it, HTML-escaped there (useDocumentTitle.test.tsx checks
// they match).
export const HOME_TITLE = 'SKS App: Theorie lernen mit Fragenkatalog & Probeprüfung'

let firstRun = true

// Keeps the tab title in step with the page after a client-side navigation. A prerendered page
// loaded directly keeps its own, longer <title> (publicPages.ts): the root is tagged with its path.
export function useDocumentTitle(title: string) {
  const { pathname } = useLocation()
  useEffect(() => {
    const landedOnPrerendered = firstRun && document.getElementById('root')?.dataset.prerendered === pathname
    firstRun = false
    if (!landedOnPrerendered) document.title = title
  }, [title, pathname])
}

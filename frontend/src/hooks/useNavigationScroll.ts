import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// React Router's client-side navigation only swaps the rendered route; it never scrolls. So a
// link at the bottom of a long page (the footer's "Datenschutz") would open the next page
// halfway down, and a cross-page `Link to="/faq#quelle"` wouldn't reach its anchor (a
// same-page `<a href="#anmelden">` gets the browser's native scroll for free). This does both:
// to the hash's element if there is one, otherwise to the top. Not on back/forward (POP, which
// also covers the first load), where the browser restores the previous position itself.
export function useNavigationScroll() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
    } else if (navigationType !== 'POP') {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash, navigationType])
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// A same-page `<a href="#anmelden">` gets the browser's native scroll-to-anchor
// for free, but a cross-page `Link to="/faq#quelle"` doesn't: React Router's
// client-side navigation only swaps the rendered route, it never asks the
// browser to scroll to the fragment. This does that explicitly on every
// location change that carries a hash.
export function useScrollToHash() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
}

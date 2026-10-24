// Scrolls down just far enough that `el`'s bottom edge clears the viewport by
// `margin`, and never scrolls up. Used after revealing content (an answer, an
// AI suggestion) that can push the "Weiter" button further down than the page
// already scrolled for.
export function scrollBelowIntoView(el: HTMLElement | null, margin = 2) {
  if (!el) return
  const overflow = el.getBoundingClientRect().bottom - window.innerHeight + margin
  if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'smooth' })
}

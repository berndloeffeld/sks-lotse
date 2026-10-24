import { useEffect, useRef } from 'react'

import { trackEvent } from '../../shared/analytics'

// How far down a page visitors read: sends `event` with the section's fixed key once per page view,
// as soon as the section reaches the middle of the screen. Off while `enabled` is false (the landing page
// counts guests only) and where IntersectionObserver is missing (prerender, old browsers).
export function useSectionSeen<T extends Element>(event: string, section: string, enabled = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        trackEvent(event, { section })
        observer.disconnect()
      },
      // Not a share of the section: a long one never fits a phone's screen. Counted once its top
      // has crossed the middle of the screen.
      { rootMargin: '0px 0px -50% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [event, section, enabled])

  return ref
}

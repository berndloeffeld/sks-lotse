import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { analyticsLoaded, wantsAnalytics } from '../analytics'

// Arriving at the admin tools by in-app navigation from a document that already runs the Umami
// script: it can't be unloaded, so the page is loaded afresh, and initAnalytics leaves it out
// there. Can't loop: a document that starts on /admin never loads it.
export function useAdminWithoutAnalytics(reload: (url: string) => void = (url) => window.location.replace(url)) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!wantsAnalytics(pathname) && analyticsLoaded()) reload(window.location.href)
  }, [pathname, reload])
}

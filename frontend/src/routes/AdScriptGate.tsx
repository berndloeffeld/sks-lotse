import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import {
  adScriptLoaded,
  consumeAdFreeReload,
  injectAdScript,
  markAdFreeReload,
  useShowAds,
  wantsAdScript,
} from '../ads'
import { useAuthStore } from '../store/authStore'

// Decided once per document, before anything could inject the script: whether it was served with
// the static tag (a prerendered public page), and whether it is the result of our own reload. The
// marker is cleared on every start, so a leftover one can't suppress a later reload.
const startedWithStaticTag = typeof document !== 'undefined' && adScriptLoaded()
const arrivedByReload = consumeAdFreeReload()

// Wraps /login and every logged-in route (ADR-0027 addendum 2026-09-23). Loads Google's ad script
// where the visitor should see ads — once the session check has said whether the account removed
// them — and gets a document out of a page that must not run it (an ads-removed account, the admin
// tools): the script can't be unloaded, so that takes one full load of the same URL, which Render
// serves as the script-free app.html. Only if the document was served with the static tag *and*
// already came from that reload does it stay put — that is a misconfigured rewrite, not a loop.
export function AdScriptGate({
  reload = (url: string) => window.location.replace(url),
}: {
  reload?: (url: string) => void
}) {
  const { pathname } = useLocation()
  const isLoading = useAuthStore((state) => state.isLoading)
  const want = wantsAdScript(useShowAds(), pathname)

  useEffect(() => {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID
    if (!isLoading && want && clientId) injectAdScript(clientId)
  }, [isLoading, want])

  const mustLeave = !isLoading && !want && adScriptLoaded() && !(startedWithStaticTag && arrivedByReload)
  if (mustLeave && markAdFreeReload()) {
    reload(window.location.href)
    return null
  }
  return <Outlet />
}

import { Outlet } from 'react-router-dom'

import { adScriptLoaded, consumeAdFreeReload, markAdFreeReload } from '../ads'

// Decided once per document: the ad script is a static tag in the served HTML (ADR-0041), and the
// reload marker is cleared on every start, so a leftover one can't suppress a later reload.
const startedInAdDocument = typeof document !== 'undefined' && adScriptLoaded()
const arrivedByReload = consumeAdFreeReload()

// Wraps /login and every logged-in route. Google's ad script runs as same-origin JavaScript, so in a
// document that loaded it (a prerendered public page, then client-side navigation into the app) it
// could read the login code being typed or call the API with the session cookie. Such a document
// is left once, by a full load of the same URL, which Render serves as the script-free app.html.
// If that document still has the script, the marker stops a loop and the route renders anyway.
export function AdFreeDocument({
  reload = (url: string) => window.location.replace(url),
}: {
  reload?: (url: string) => void
}) {
  if (startedInAdDocument && !arrivedByReload && markAdFreeReload()) {
    reload(window.location.href)
    return null
  }
  return <Outlet />
}

// Where the login sends the learner back to: the page they came from. It travels as router state
// (`{ from }`, set by ProtectedRoute and the guest login links), never as a query parameter, so a
// link from elsewhere can't set it; it is checked all the same, so only a path of this app is ever
// followed — no open redirect.

export interface LoginState {
  from?: string
}

interface LocationLike {
  pathname: string
  search: string
  hash: string
}

const DEFAULT_TARGET = '/learn'
const BASE = 'https://sks-lotse.invalid'

// Pages there is no point in returning to: the landing page (logged in, /learn is the start) and
// the login itself.
function isWorthReturningTo(pathname: string): boolean {
  return pathname !== '/' && pathname !== '/login'
}

// The state a link to /login carries: the page it was followed from, where that is worth returning to.
export function loginState(location: LocationLike): LoginState {
  return isWorthReturningTo(location.pathname) ? { from: `${location.pathname}${location.search}${location.hash}` } : {}
}

// The return target from a location's state, or /learn. Read the way the browser reads a URL (it
// drops tabs and line breaks, takes "\" for "/", resolves "." and ".."), it has to stay on this
// origin. That normalized form is what is returned, so its path must not start with "//" either
// ("/.//host" becomes "//host"), which a link or navigate() would take for another host.
export function safeReturnPath(state: unknown): string {
  const from = state && typeof state === 'object' ? (state as LoginState).from : undefined
  if (typeof from !== 'string' || !from.startsWith('/')) return DEFAULT_TARGET
  const url = new URL(from, BASE)
  if (url.origin !== BASE || url.pathname.startsWith('//') || !isWorthReturningTo(url.pathname)) return DEFAULT_TARGET
  return `${url.pathname}${url.search}${url.hash}`
}

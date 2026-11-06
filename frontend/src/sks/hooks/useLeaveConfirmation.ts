import { useEffect } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'

// While `active` (work that exists in the page only would be lost), leaving asks first: closing or
// reloading the tab through the browser's own prompt, a link or Back/Forward through the returned
// blocker, which the caller shows as its dialog (proceed() leaves, reset() stays). Needs the data
// router (ADR-0059). Changes of the hash alone aren't leaving.
export function useLeaveConfirmation(active: boolean): Blocker {
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older browsers only prompt for a truthy returnValue.
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )

  // Nothing left to lose while the question is open: let the navigation be.
  useEffect(() => {
    if (!active && blocker.state === 'blocked') blocker.reset()
  }, [active, blocker])

  return blocker
}

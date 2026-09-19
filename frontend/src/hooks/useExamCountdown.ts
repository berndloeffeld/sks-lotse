import { useEffect, useRef, useState } from 'react'

// Milliseconds left until `deadlineIso`, ticking once a second. `serverNowIso`
// corrects for a wrong device clock: the offset between the server's and the
// device's "now" at load time is applied to every tick. `onExpired` fires once
// when the time runs out.
export function useExamCountdown(deadlineIso: string, serverNowIso: string, onExpired: () => void): number {
  // Captured once per loaded exam (a lazy initializer, so it's not re-read on render).
  const [offset] = useState(() => Date.parse(serverNowIso) - Date.now())
  const remaining = () => Date.parse(deadlineIso) - (Date.now() + offset)
  const [remainingMs, setRemainingMs] = useState(remaining)
  const expiredRef = useRef(false)
  const onExpiredRef = useRef(onExpired)

  useEffect(() => {
    onExpiredRef.current = onExpired
  })

  useEffect(() => {
    const tick = () => {
      const left = Date.parse(deadlineIso) - (Date.now() + offset)
      setRemainingMs(left)
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpiredRef.current()
      }
    }
    const id = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(id)
  }, [deadlineIso, offset])

  return remainingMs
}

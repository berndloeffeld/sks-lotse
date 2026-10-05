import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'

// `useNavigate` that does nothing once the component has unmounted. react-router keeps navigating
// after that, so a response that arrives late (a started exam, a finished login, a deleted account)
// would pull the learner back from the page they have meanwhile moved on to.
export function useNavigateWhileMounted() {
  const navigate = useNavigate()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return useCallback(
    (to: To, options?: NavigateOptions) => {
      if (mounted.current) void navigate(to, options)
    },
    [navigate],
  )
}

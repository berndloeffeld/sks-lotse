import { useCallback, useEffect, useRef, useState } from 'react'

interface QueryState<T> {
  // Which `key` the data below belongs to; null before the first answer arrived.
  key: string | null
  data: T | undefined
  failed: boolean
}

type Update<T> = T | ((current: T) => T)

// Loads data for one screen: once on mount and again whenever `key` changes. The page's other
// fetch-on-mount hooks build on it, so they all handle the same three things the same way:
// - a response for an older key (the learner already moved on) is dropped, never shown;
// - a new key shows "loading" again instead of the previous screen's data;
// - `reload` refreshes in place — the current data stays on screen while it runs — and resolves
//   when done, so a caller can await it (e.g. after a write).
//
// `fetcher` may be a fresh closure every render; the latest one is used. Everything it depends on
// must be reflected in `key`.
export function useApiQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ key: null, data: undefined, failed: false })
  const fetcherRef = useRef(fetcher)
  const keyRef = useRef(key)
  useEffect(() => {
    fetcherRef.current = fetcher
    keyRef.current = key
  })

  useEffect(() => {
    let active = true
    fetcherRef.current().then(
      (data) => {
        if (active) setState({ key, data, failed: false })
      },
      () => {
        if (active) setState({ key, data: undefined, failed: true })
      },
    )
    return () => {
      active = false
    }
  }, [key])

  const reload = useCallback(async () => {
    const reloading = keyRef.current
    try {
      const data = await fetcherRef.current()
      setState((current) => (current.key === reloading ? { key: reloading, data, failed: false } : current))
    } catch {
      setState((current) => (current.key === reloading ? { ...current, failed: true } : current))
    }
  }, [])

  // Replace the data with fresher server state a write returned, without refetching.
  const setData = useCallback((update: Update<T>) => {
    setState((current) => {
      if (current.data === undefined) return current
      const data = typeof update === 'function' ? (update as (value: T) => T)(current.data) : update
      return { ...current, data, failed: false }
    })
  }, [])

  const current = state.key === key
  return {
    data: current ? state.data : undefined,
    isLoading: !current,
    failed: current && state.failed,
    reload,
    setData,
  }
}

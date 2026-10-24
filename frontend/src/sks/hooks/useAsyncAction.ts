import { useCallback, useState } from 'react'

type ErrorMessage = string | ((error: unknown) => string)

// The busy/error state of one button or form: `run` clears the previous error, sets `isPending`
// while the action runs and, if it throws, shows `errorMessage` (or what it returns for the error)
// as `error`. `setError` is for a message the caller decides on before running anything, e.g. a
// failed input check.
export function useAsyncAction() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<unknown>, errorMessage: ErrorMessage) => {
    setError(null)
    setIsPending(true)
    try {
      await action()
    } catch (err) {
      setError(typeof errorMessage === 'function' ? errorMessage(err) : errorMessage)
    } finally {
      setIsPending(false)
    }
  }, [])

  return { run, isPending, error, setError }
}

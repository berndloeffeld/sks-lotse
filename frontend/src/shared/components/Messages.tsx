import { useState, type ReactNode } from 'react'

const ERROR_BOX =
  'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-tile bg-danger px-3 py-2 text-sm text-surface'

const STATUS_BOX = {
  success: 'rounded-tile border-l-4 border-success bg-surface px-3 py-2 text-ink',
  neutral: 'rounded-tile border-l-4 border-border bg-surface px-3 py-2 text-ink-soft',
}

// Every error the app shows, the same box, announced at once (role="alert"). Renders nothing
// without a message, so a caller can pass a possibly-null error straight in. With `onRetry` (a
// failed load: hand it the query's `reload`) it offers "Erneut laden", locked while that runs.
export function ErrorMessage({
  children,
  onRetry,
  className = '',
}: {
  children: ReactNode
  onRetry?: () => unknown
  className?: string
}) {
  const [isRetrying, setIsRetrying] = useState(false)
  if (children === null || children === undefined || children === false || children === '') return null

  async function retry() {
    setIsRetrying(true)
    try {
      await onRetry?.()
    } catch {
      // The message stays up, and so does the button for another try.
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div role="alert" className={`${ERROR_BOX} ${className}`}>
      <p>{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={isRetrying}
          className="underline disabled:opacity-60"
        >
          {isRetrying ? 'Wird geladen…' : 'Erneut laden'}
        </button>
      ) : null}
    </div>
  )
}

// A confirmation that something worked ("Gespeichert."), announced politely (role="status"). The
// live region stays mounted while empty: a screen reader only announces a change inside a region
// that was already there.
export function StatusMessage({
  children,
  tone = 'success',
  className = '',
}: {
  children: ReactNode
  tone?: keyof typeof STATUS_BOX
  className?: string
}) {
  const empty = children === null || children === undefined || children === false || children === ''
  return (
    <p role="status" className={empty ? 'sr-only' : `${STATUS_BOX[tone]} ${className}`}>
      {empty ? null : children}
    </p>
  )
}

import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import { LegalFooter } from '../components/LegalFooter'
import { useAuthStore } from '../store/authStore'

type Step = 'email' | 'code'

export function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const checkSession = useAuthStore((state) => state.checkSession)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Already signed in (e.g. back button after a prior login) — skip the form.
  if (isAuthenticated) {
    return <Navigate to="/start" replace />
  }

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/otp/request', { email })
      setStep('code')
    } catch {
      // The backend always returns 202 here, even for a rejected address
      // (see backend/app/api/v1/auth.py) — a thrown error means something
      // else went wrong (network, malformed input).
      setError('Der Code konnte nicht angefordert werden. Bitte E-Mail-Adresse prüfen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/otp/verify', { email, code })
      await checkSession()
      navigate('/start')
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Der Code ist ungültig oder abgelaufen.'
          : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="font-serif text-2xl text-ink">Anmelden</h1>

      {step === 'email' ? (
        <form className="flex flex-col gap-4" onSubmit={handleRequestCode}>
          <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="email">
            E-Mail-Adresse
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border border-border bg-surface px-3 py-2 text-ink"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
          >
            Code anfordern
          </button>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleVerifyCode}>
          <p className="text-sm text-ink-soft">Code gesendet an {email}.</p>
          <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="code">
            Login-Code
            <input
              id="code"
              type="text"
              inputMode="numeric"
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="border border-border bg-surface px-3 py-2 font-mono text-ink"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
            }}
            className="text-primary text-sm underline"
          >
            Andere E-Mail-Adresse verwenden
          </button>
        </form>
      )}
      <LegalFooter />
    </main>
  )
}

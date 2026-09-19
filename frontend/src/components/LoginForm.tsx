import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'

type Step = 'email' | 'code'

interface LoginFormProps {
  // `dark` for use on a primary band (the landing page's sign-up section),
  // `light` on the page background (the login page).
  tone?: 'light' | 'dark'
}

const TONES = {
  light: {
    label: 'text-ink-soft',
    input: 'border-primary bg-surface text-ink',
    note: 'text-ink-soft',
    link: 'text-primary',
  },
  dark: {
    label: 'text-surface',
    input: 'border-surface bg-transparent text-surface',
    note: 'text-surface-alt',
    link: 'text-surface',
  },
}

// The two-step email + OTP sign-in (request a code, then verify it),
// styled like the template's contact form: outlined fields, one accent
// button, required fields marked with *.
export function LoginForm({ tone = 'light' }: LoginFormProps) {
  const navigate = useNavigate()
  const checkSession = useAuthStore((state) => state.checkSession)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const t = TONES[tone]
  const labelClass = `flex flex-col gap-1 text-sm ${t.label}`
  const inputClass = `rounded-tile border-2 px-3 py-2 ${t.input}`
  const buttonClass =
    'rounded-tile bg-accent px-4 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink disabled:opacity-60'
  const errorMessage = error ? (
    <p role="alert" className="rounded-tile bg-danger px-3 py-2 text-sm text-surface">
      {error}
    </p>
  ) : null

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

  if (step === 'email') {
    return (
      <form className="flex flex-col gap-4" onSubmit={handleRequestCode}>
        <label className={labelClass} htmlFor="email">
          E-Mail-Adresse
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <p className={`text-xs ${t.note}`}>Wir senden dir einen Login-Code per E-Mail – ganz ohne Passwort.</p>
        {errorMessage}
        <button type="submit" disabled={isSubmitting} className={buttonClass}>
          Code anfordern
        </button>
      </form>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleVerifyCode}>
      <p className={`text-sm ${t.note}`}>Code gesendet an {email}.</p>
      <label className={labelClass} htmlFor="code">
        Login-Code
        <input
          id="code"
          type="text"
          inputMode="numeric"
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={`${inputClass} font-mono`}
        />
      </label>
      {errorMessage}
      <button type="submit" disabled={isSubmitting} className={buttonClass}>
        Anmelden
      </button>
      <button
        type="button"
        onClick={() => {
          setStep('email')
          setCode('')
          setError(null)
        }}
        className={`text-sm underline ${t.link}`}
      >
        Andere E-Mail-Adresse verwenden
      </button>
    </form>
  )
}

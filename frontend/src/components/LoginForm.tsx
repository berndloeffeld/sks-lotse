import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formStyles, type FormTone } from './formStyles'
import { useAsyncAction } from '../hooks/useAsyncAction'

type Step = 'email' | 'code'

interface LoginFormProps {
  // `dark` for use on a primary band (the landing page's sign-up section),
  // `light` on the page background (the login page).
  tone?: FormTone
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
  const { run, isPending: isSubmitting, error, setError } = useAsyncAction()

  // The code field takes focus as soon as it appears, so the code can be typed (or pasted) right away.
  const codeInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (step === 'code') codeInput.current?.focus()
  }, [step])

  const f = formStyles(tone)
  const labelClass = f.label
  const inputClass = f.input
  const buttonClass = f.button
  const errorMessage = error ? (
    <p role="alert" className={f.error}>
      {error}
    </p>
  ) : null

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault()
    // The backend always returns 202 here, even for a rejected address
    // (see backend/app/api/v1/auth.py) — a thrown error means something
    // else went wrong (network, malformed input).
    await run(async () => {
      await apiClient.post('/auth/otp/request', { email })
      setStep('code')
    }, 'Der Code konnte nicht angefordert werden. Bitte E-Mail-Adresse prüfen.')
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault()
    await run(
      async () => {
        await apiClient.post('/auth/otp/verify', { email, code })
        await checkSession()
        trackEvent('login')
        navigate('/learn')
      },
      (err) =>
        err instanceof ApiError && err.status === 401
          ? 'Der Code ist ungültig oder abgelaufen.'
          : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
    )
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
        <p className={`text-xs ${f.note}`}>Wir senden dir einen Login-Code per E-Mail – ganz ohne Passwort.</p>
        {errorMessage}
        <button type="submit" disabled={isSubmitting} className={buttonClass}>
          Jetzt starten
        </button>
      </form>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleVerifyCode}>
      <p className={`text-sm ${f.note}`}>Code gesendet an {email}.</p>
      <label className={labelClass} htmlFor="code">
        Login-Code
        <input
          id="code"
          ref={codeInput}
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
        className={f.link}
      >
        Andere E-Mail-Adresse verwenden
      </button>
    </form>
  )
}

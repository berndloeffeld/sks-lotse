import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { API_BASE_URL, ApiError, apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formStyles, type FormTone } from './formStyles'

type Step = 'email' | 'code'

const SSO_LABELS: Record<string, string> = { google: 'Google', facebook: 'Facebook' }

// The backend redirects back to /login?sso_error=<code> when an SSO sign-in didn't work out.
const SSO_ERRORS: Record<string, string> = {
  cancelled: 'Die Anmeldung wurde abgebrochen.',
  no_email: 'Der Anbieter hat keine bestätigte E-Mail-Adresse geliefert. Bitte melde dich per E-Mail-Code an.',
  not_allowed: 'Mit dieser E-Mail-Adresse ist die Anmeldung derzeit nicht möglich.',
  failed: 'Die Anmeldung über den Anbieter ist fehlgeschlagen. Bitte erneut versuchen.',
}

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
  const [searchParams] = useSearchParams()
  const ssoError = searchParams.get('sso_error')
  const [error, setError] = useState<string | null>(ssoError ? (SSO_ERRORS[ssoError] ?? SSO_ERRORS.failed) : null)
  const [ssoProviders, setSsoProviders] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Only the providers this deployment has configured get a button; a failure here just means
    // the email login stays the only option.
    apiClient
      .get<{ providers: string[] }>('/auth/sso/providers')
      .then((result) => setSsoProviders(result.providers.filter((name) => name in SSO_LABELS)))
      .catch(() => undefined)
  }, [])

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
      trackEvent('login')
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
        <p className={`text-xs ${f.note}`}>Wir senden dir einen Login-Code per E-Mail – ganz ohne Passwort.</p>
        {errorMessage}
        <button type="submit" disabled={isSubmitting} className={buttonClass}>
          Code anfordern
        </button>
        {ssoProviders.length > 0 && (
          <>
            <p className={`text-center text-xs ${f.note}`}>oder</p>
            {ssoProviders.map((name) => (
              <a
                key={name}
                href={`${API_BASE_URL}/api/v1/auth/sso/${name}/start`}
                onClick={() => trackEvent('login_sso', { provider: name })}
                className={`${buttonClass} text-center`}
              >
                Mit {SSO_LABELS[name]} anmelden
              </a>
            ))}
          </>
        )}
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

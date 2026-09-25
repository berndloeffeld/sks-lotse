import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { CheckoutRead, PublicPricing, PublicTokenPackage, User } from '../api/types'
import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { formatEurCents } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { PACKAGE_LABELS, type PackageProduct } from '../labels'
import { useAuthStore } from '../store/authStore'

const styles = formStyles('light')

// How long after the return from Stripe the balance is fetched once more: the webhook that credits
// the tokens (ADR-0048) usually lands before the redirect, but isn't guaranteed to.
export const BALANCE_RECHECK_MS = 5000

// The "bald verfügbar" kicker used throughout the app (LandingPage's PLANS cards, AiAnswerCheck's
// teaser) for a feature that's designed but not purchasable yet.
function SoonKicker() {
  return <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">Bald verfügbar</span>
}

function packageLabel(pkg: PublicTokenPackage) {
  return PACKAGE_LABELS[pkg.product as PackageProduct] ?? pkg.product
}

function PackageDetails({ pkg }: { pkg: PublicTokenPackage }) {
  return (
    <>
      <span className="font-mono text-xs tracking-wide text-ink-soft uppercase">{packageLabel(pkg)}</span>
      <span className="font-serif text-2xl text-primary">{pkg.tokens} Tokens</span>
      <span className="text-lg text-ink">{formatEurCents(pkg.price_cents)}</span>
      <span className="text-xs text-ink-soft">
        {formatEurCents(Math.round(pkg.price_cents / pkg.tokens))} pro Token
      </span>
    </>
  )
}

function PackageCard({ pkg, soon }: { pkg: PublicTokenPackage; soon: boolean }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-tile border bg-surface p-4 ${soon ? 'border-dashed border-accent' : 'border-border'}`}
    >
      {soon ? <SoonKicker /> : null}
      <PackageDetails pkg={pkg} />
    </div>
  )
}

function checkoutErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return 'Der Kauf ist gerade nicht möglich.'
  return 'Die Zahlung konnte nicht gestartet werden. Versuche es später noch einmal.'
}

// Pick a package, confirm the § 356 Abs. 5 BGB waiver, go to Stripe's hosted payment page. The
// tokens are credited by the webhook, never by coming back here (ADR-0048).
function PurchasePanel({ packages }: { packages: PublicTokenPackage[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [waived, setWaived] = useState(false)
  const { run, isPending, error, setError } = useAsyncAction()
  const pkg = packages.find((p) => p.product === selected)

  function buy() {
    if (!pkg) return setError('Wähle zuerst ein Paket.')
    if (!waived) return setError('Bitte bestätige zuerst die Zustimmung zur sofortigen Bereitstellung.')
    return run(async () => {
      const { url } = await apiClient.post<CheckoutRead>('/payments/checkout', {
        product: pkg.product,
        waive_withdrawal: true,
      })
      window.location.assign(url)
    }, checkoutErrorMessage)
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <legend className="sr-only">Paket wählen</legend>
        {packages.map((p) => (
          <label
            key={p.product}
            className="flex cursor-pointer flex-col gap-2 rounded-tile border-2 border-border bg-surface p-4 transition hover:border-primary has-checked:border-primary has-checked:bg-surface-alt has-focus-visible:ring-2 has-focus-visible:ring-primary"
          >
            <input
              type="radio"
              name="token-package"
              value={p.product}
              checked={selected === p.product}
              onChange={() => {
                setSelected(p.product)
                setError(null)
              }}
              className="sr-only"
            />
            <PackageDetails pkg={p} />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={waived}
            onChange={(event) => {
              setWaived(event.target.checked)
              setError(null)
            }}
            className="mt-1 accent-primary"
          />
          <span>
            Ich stimme ausdrücklich zu, dass SKS Lotse die Tokens sofort nach der Zahlung bereitstellt, und weiß, dass
            ich damit mein Widerrufsrecht verliere (
            <Link to="/terms" className="underline">
              AGB
            </Link>
            ).
          </span>
        </label>
        <button type="button" onClick={() => void buy()} disabled={isPending} className={`self-start ${styles.button}`}>
          {isPending
            ? 'Weiter zu Stripe …'
            : pkg
              ? `${packageLabel(pkg)} für ${formatEurCents(pkg.price_cents)} kaufen`
              : 'Paket kaufen'}
        </button>
        <p className="text-xs text-ink-soft">
          Die Zahlung läuft über Stripe; danach kommst du hierher zurück. Kein Abo, keine wiederkehrende Zahlung.
        </p>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

// Back from Stripe (`?checkout=success|cancelled`, set in backend/app/services/payments.py): say
// what happened and, after a payment, fetch the new balance — once now, once more a little later.
function CheckoutReturnNotice({ status }: { status: string | null }) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const loggedIn = user !== null
  useEffect(() => {
    if (status !== 'success' || !loggedIn) return
    const refresh = () => {
      apiClient
        .get<User>('/auth/me')
        .then(setUser)
        .catch(() => {})
    }
    refresh()
    const timer = window.setTimeout(refresh, BALANCE_RECHECK_MS)
    return () => window.clearTimeout(timer)
  }, [status, loggedIn, setUser])

  if (status === 'success') {
    return (
      <p role="status" className="rounded-tile border-l-4 border-success bg-surface px-3 py-2 text-ink">
        Danke für deinen Kauf! Die Tokens werden deinem Konto gutgeschrieben
        {user ? ` – aktueller Stand: ${user.token_balance} Tokens` : ''}.
      </p>
    )
  }
  if (status === 'cancelled') {
    return (
      <p role="status" className="rounded-tile border-l-4 border-border bg-surface px-3 py-2 text-ink-soft">
        Zahlung abgebrochen – es wurde nichts berechnet.
      </p>
    )
  }
  return null
}

// A standalone page for the token/Werbefrei prices (ADR-0043), linked from the header nav. The
// token packages can be bought here once the STRIPE_CHECKOUT flag lets this account
// (`user.can_buy_tokens`, ADR-0048); until then — and for Werbefrei, which isn't sold yet — the
// "bald verfügbar" framing repeats at every level so it can't be skimmed past as a live offer.
export function PricingPage() {
  const { data, isLoading, failed } = useApiQuery('pricing-page', () => apiClient.get<PublicPricing>('/pricing'))
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  const canBuy = user?.can_buy_tokens ?? false
  // Open to everyone, but this visitor isn't logged in (a logged-in account then has can_buy_tokens).
  const loginToBuy = !canBuy && (data?.checkout_enabled ?? false)
  const tokensSoon = !canBuy && !loginToBuy

  return (
    <PageLayout
      title="Tokens"
      nav="public"
      subtitle={
        tokensSoon ? (
          <span className="inline-block rounded-tile border border-dashed border-surface-alt px-3 py-1 font-mono text-xs font-bold tracking-wide uppercase">
            Bald verfügbar
          </span>
        ) : undefined
      }
    >
      <CheckoutReturnNotice status={searchParams.get('checkout')} />

      <section className="flex flex-col gap-2">
        <p className="text-ink-soft">
          Die Grundfunktion von SKS Lotse (Fragen üben, amtliche Musterantwort, Lernfortschritt) bleibt dauerhaft
          kostenlos.{' '}
          {tokensSoon
            ? 'Diese Seite zeigt, was für „Werbefrei" und den Lotsen-Check geplant ist – ein Kauf ist hier noch nicht möglich, das Zahlungssystem kommt noch.'
            : 'Tokens für den Lotsen-Check kannst du hier kaufen; „Werbefrei" folgt noch.'}
        </p>
      </section>

      {isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      {failed ? <p className="text-sm text-danger">Die Preise konnten nicht geladen werden.</p> : null}

      {data ? (
        <>
          <section className="flex flex-col gap-2 rounded-tile border border-dashed border-accent bg-surface p-4">
            <SoonKicker />
            <h2 className="font-serif text-xl text-primary">Werbefrei</h2>
            <p className="text-ink-soft">Einmalige Zahlung, entfernt die Werbeeinblendungen dauerhaft.</p>
            <p className="font-serif text-2xl text-primary">{formatEurCents(data.ads_removed_price_cents)}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-serif text-xl text-primary">Tokens für den Lotsen-Check</h2>
            <p className="text-ink-soft">
              Ein Token berechtigt zu einem automatisierten KI-Bewertungsvorschlag für eine Antwort. Bei der Anmeldung
              gibt es {data.signup_bonus_tokens} Tokens geschenkt; weitere Tokens lassen sich in Paketen nachkaufen.
              {canBuy ? ` Dein Stand: ${user?.token_balance ?? 0} Tokens.` : ''}
            </p>
            {canBuy ? (
              <PurchasePanel packages={data.packages} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {data.packages.map((pkg) => (
                    <PackageCard key={pkg.product} pkg={pkg} soon={tokensSoon} />
                  ))}
                </div>
                {loginToBuy ? (
                  <p className="text-ink-soft">
                    <Link to="/login" className="underline">
                      Melde dich an
                    </Link>
                    , um ein Paket zu kaufen.
                  </p>
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </PageLayout>
  )
}

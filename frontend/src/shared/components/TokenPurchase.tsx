import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { CheckoutRead, PublicTokenPackage, User } from '../api/types'
import { isCheckoutUrl } from '../checkout'
import { formatEurCents } from '../format'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { BALANCE_RECHECK_MS, type Pricing } from '../hooks/usePricing'
import { PACKAGE_LABELS, type PackageProduct } from '../labels'
import { siteIdentity } from '../siteConfig'
import { useAuthStore } from '../store/authStore'
import { GuestCta } from './LoginLink'
import { ErrorMessage, StatusMessage } from './Messages'
import { buttonClass } from './buttonStyles'

// Buying token packages (ADR-0043, ADR-0048), the same on both sites: the account and its balance
// are one (ADR-0070). Each site's /pricing page says around it what the tokens are for.

// The "bald verfügbar" kicker for the packages while they're designed but not purchasable yet.
function SoonKicker() {
  return <span className="font-mono text-xs font-bold tracking-wide text-accent-strong uppercase">Bald verfügbar</span>
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

export function PackageCard({ pkg, soon }: { pkg: PublicTokenPackage; soon: boolean }) {
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
  if (error instanceof ApiError && error.status === 409) return 'Bitte bestätige zuerst die aktuellen AGB.'
  return 'Die Zahlung konnte nicht gestartet werden. Versuche es später noch einmal.'
}

// Pick a package, confirm the § 356 Abs. 5 BGB waiver, go to Stripe's hosted payment page. The
// tokens are credited by the webhook, never by coming back here (ADR-0048).
export function PurchasePanel({
  packages,
  boughtProduct,
}: {
  packages: PublicTokenPackage[]
  boughtProduct: string | null
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [waived, setWaived] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const { run, isPending, error, setError } = useAsyncAction()
  const pkg = packages.find((p) => p.product === selected)

  function buy() {
    if (!pkg) return setError('Wähle zuerst ein Paket.')
    if (!waived) return setError('Bitte bestätige zuerst die Zustimmung zur sofortigen Bereitstellung.')
    return run(async () => {
      const { url } = await apiClient
        .post<CheckoutRead>('/payments/checkout', { product: pkg.product, waive_withdrawal: true })
        .catch(async (err: unknown) => {
          // The AGB changed since this page loaded (409): fetch the account again, so
          // needs_agb_acceptance is true and the AgbGate asks for the confirmation.
          if (err instanceof ApiError && err.status === 409) {
            await apiClient
              .get<User>('/auth/me')
              .then(setUser)
              .catch(() => {})
          }
          throw err
        })
      if (!isCheckoutUrl(url)) throw new Error('Unexpected checkout address')
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
            className={`relative flex cursor-pointer flex-col gap-2 rounded-tile border-2 bg-surface p-4 transition ${boughtProduct === p.product ? 'border-success' : 'border-border'}  hover:border-primary has-checked:border-primary has-checked:bg-surface-alt has-focus-visible:ring-2 has-focus-visible:ring-primary`}
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
            {/* A pill like the header's token counter, the exception to ADR-0014's square corners. */}
            {boughtProduct === p.product ? (
              <span className="absolute -top-3 right-3 rounded-full bg-success px-2.5 py-0.5 font-mono text-xs tracking-wide whitespace-nowrap text-surface uppercase">
                Gerade gekauft
              </span>
            ) : null}
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
            Ich stimme ausdrücklich zu, dass {siteIdentity().name} die Tokens sofort nach der Zahlung bereitstellt, und
            weiß, dass ich damit mein Widerrufsrecht verliere (
            <Link to="/terms" className="underline">
              AGB
            </Link>
            ).
          </span>
        </label>
        <button
          type="button"
          onClick={() => void buy()}
          disabled={isPending}
          className={`self-start ${buttonClass('primary')}`}
        >
          {isPending
            ? 'Weiter zur Zahlung …'
            : pkg
              ? `${packageLabel(pkg)} für ${formatEurCents(pkg.price_cents)} kaufen`
              : 'Paket kaufen'}
        </button>
        <p className="text-xs text-ink-soft">
          Du wirst zur Zahlung an unseren Zahlungsanbieter weitergeleitet und kommst danach hierher zurück.
        </p>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    </div>
  )
}

// Back from Stripe (`?checkout=success|cancelled`, set in backend/app/services/payments.py): say
// what happened and, after a payment, fetch the new balance — once now, once more a little later.
export function CheckoutReturnNotice({ status }: { status: string | null }) {
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
      <StatusMessage>
        Danke für deinen Kauf! Die Tokens werden deinem Konto gutgeschrieben
        {user ? ` – aktueller Stand: ${user.token_balance} Tokens` : ''}.
      </StatusMessage>
    )
  }
  if (status === 'cancelled') {
    return <StatusMessage tone="neutral">Zahlung abgebrochen – es wurde nichts berechnet.</StatusMessage>
  }
  return null
}

// The packages: to pick and buy for an account that can, otherwise to look at (with the way to the
// login once checkout is open to everyone).
export function TokenPackages({ pricing }: { pricing: Pricing }) {
  const { data, isLoading, failed, reload, user, canBuy, boughtProduct, loginToBuy, tokensSoon } = pricing
  return (
    <>
      {isLoading ? <p className="text-sm text-ink-soft">Lädt …</p> : null}
      <ErrorMessage onRetry={reload}>{failed ? 'Die Preise konnten nicht geladen werden.' : null}</ErrorMessage>
      {data && canBuy ? (
        <>
          <p className="text-ink-soft">Dein aktueller Stand: {user?.token_balance ?? 0} Tokens.</p>
          <PurchasePanel packages={data.packages} boughtProduct={boughtProduct} />
        </>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.packages.map((pkg) => (
              <PackageCard key={pkg.product} pkg={pkg} soon={tokensSoon} />
            ))}
          </div>
          {loginToBuy ? <GuestCta place="pricing">Melde dich an, um ein Paket zu kaufen.</GuestCta> : null}
        </>
      ) : null}
    </>
  )
}

// The "Bald verfügbar" badge in a page's title band while no package can be bought.
export function TokensSoonBadge() {
  return (
    <span className="inline-block rounded-tile border border-dashed border-surface-alt px-3 py-1 font-mono text-xs font-bold tracking-wide uppercase">
      Bald verfügbar
    </span>
  )
}

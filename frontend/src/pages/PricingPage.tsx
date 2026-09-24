import { apiClient } from '../api/client'
import type { PublicPricing, PublicTokenPackage } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { formatEurCents } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { PACKAGE_LABELS, type PackageProduct } from '../labels'

// The "bald verfügbar" kicker used throughout the app (LandingPage's PLANS cards, AiAnswerCheck's
// teaser) for a feature that's designed but not purchasable yet — repeated above every price here
// so it can't be mistaken for a live offer.
function SoonKicker() {
  return <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">Bald verfügbar</span>
}

function PackageCard({ pkg }: { pkg: PublicTokenPackage }) {
  const perToken = pkg.price_cents / pkg.tokens
  return (
    <div className="flex flex-col gap-2 rounded-tile border border-dashed border-accent bg-surface p-4">
      <SoonKicker />
      <span className="font-mono text-xs tracking-wide text-ink-soft uppercase">
        {PACKAGE_LABELS[pkg.product as PackageProduct] ?? pkg.product}
      </span>
      <span className="font-serif text-2xl text-primary">{pkg.tokens} Tokens</span>
      <span className="text-lg text-ink">{formatEurCents(pkg.price_cents)}</span>
      <span className="text-xs text-ink-soft">{formatEurCents(Math.round(perToken))} pro Token</span>
    </div>
  )
}

// A standalone page for the token/Werbefrei prices (ADR-0043) — a preview only, since there is no
// purchase flow yet (no buy buttons); linked from the header nav so it's reachable from every page.
// The "bald verfügbar" framing repeats at three levels (subtitle banner, section kicker, each
// card) so it can't be skimmed past as a live price list.
export function PricingPage() {
  const { data, isLoading, failed } = useApiQuery('pricing-page', () => apiClient.get<PublicPricing>('/pricing'))

  return (
    <PageLayout
      title="Preise"
      nav="public"
      subtitle={
        <span className="inline-block rounded-tile border border-dashed border-surface-alt px-3 py-1 font-mono text-xs font-bold tracking-wide uppercase">
          Bald verfügbar
        </span>
      }
    >
      <section className="flex flex-col gap-2">
        <p className="text-ink-soft">
          Die Grundfunktion von SKS Lotse (Fragen üben, amtliche Musterantwort, Lernfortschritt) bleibt dauerhaft
          kostenlos. Diese Seite zeigt, was für „Werbefrei" und den Lotsen-Check geplant ist – ein Kauf ist hier noch
          nicht möglich, das Zahlungssystem kommt noch.
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
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {data.packages.map((pkg) => (
                <PackageCard key={pkg.product} pkg={pkg} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </PageLayout>
  )
}

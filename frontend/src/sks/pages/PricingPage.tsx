import { PageLayout } from '../components/PageLayout'
import { CheckoutReturnNotice, TokenPackages, TokensSoonBadge } from '../../shared/components/TokenPurchase'
import { usePricing } from '../../shared/hooks/usePricing'
import { sectionHeading } from '../../shared/components/headingStyles'

export { BALANCE_RECHECK_MS } from '../../shared/hooks/usePricing'

// A standalone page for the token prices (ADR-0043), linked from the header nav. The
// token packages can be bought here once the STRIPE_CHECKOUT flag lets this account
// (`user.can_buy_tokens`, ADR-0048); until then the
// "bald verfügbar" framing repeats at every level so it can't be skimmed past as a live offer.
export function PricingPage() {
  const pricing = usePricing()
  const { data, checkout, tokensSoon } = pricing

  return (
    <PageLayout title="Preise" nav="public" subtitle={tokensSoon ? <TokensSoonBadge /> : undefined}>
      <CheckoutReturnNotice status={checkout} />

      {tokensSoon ? (
        <p className="text-ink-soft">
          Diese Seite zeigt, was für den Lotsen-Check geplant ist – ein Kauf ist hier noch nicht möglich, das
          Zahlungssystem kommt noch.
        </p>
      ) : null}

      {/* What is free and what costs stands in the prerendered page too (ADR-0025): the prices
          themselves come from the API, only once the page runs. */}
      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Kostenlos lernen</h2>
        <p className="text-ink-soft">
          Die Grundfunktion – Fragen üben, die amtlichen Antworten und dein Lernfortschritt – ist dauerhaft kostenlos.
          Auch die Kartenaufgaben und die Probeprüfung kosten derzeit nichts. Kosten entstehen nur, wenn du dir vom
          Lotsen-Check einen KI-Bewertungsvorschlag für deine Antwort geben lässt.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Tokens für den Lotsen-Check</h2>
        <p className="text-ink-soft">
          Ein Token berechtigt zu einem automatisierten KI-Bewertungsvorschlag für eine Katalogfrage, eine Aufgabe einer
          Kartenaufgabe kostet zwei Tokens.{' '}
          {data
            ? `Bei der Anmeldung gibt es ${data.signup_bonus_tokens} Tokens geschenkt; weitere Tokens lassen sich in Paketen nachkaufen.`
            : 'Tokens gibt es in Paketen.'}{' '}
          Kein Abo, keine wiederkehrende Zahlung.
        </p>
        <TokenPackages pricing={pricing} />
      </section>
    </PageLayout>
  )
}

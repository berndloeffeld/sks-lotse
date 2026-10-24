import { CheckoutReturnNotice, TokenPackages, TokensSoonBadge } from '../shared/components/TokenPurchase'
import { sectionHeading } from '../shared/components/headingStyles'
import { usePricing } from '../shared/hooks/usePricing'
import { SbfPageLayout } from './SbfPageLayout'

// SBF Lotse's prices (ADR-0070): the same packages and balance as on sks-lotse.de, said for the
// Navigationsaufgaben.
export function SbfPricingPage() {
  const pricing = usePricing()
  const { data, checkout, tokensSoon } = pricing

  return (
    <SbfPageLayout title="Preise" subtitle={tokensSoon ? <TokensSoonBadge /> : undefined}>
      <CheckoutReturnNotice status={checkout} />

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Kostenlos lernen</h2>
        <p className="text-ink-soft">
          Die Navigationsaufgaben mit den amtlichen Ergebnissen sind kostenlos, mit Konto auch das Speichern deiner
          Läufe. Kosten entstehen nur, wenn du dir vom Lotsen-Check einen KI-Bewertungsvorschlag für eine Teilaufgabe
          geben lässt.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Tokens für den Lotsen-Check</h2>
        <p className="text-ink-soft">
          Ein Lotsen-Check einer Teilaufgabe kostet zwei Tokens.{' '}
          {data
            ? `Bei der Anmeldung gibt es ${data.signup_bonus_tokens} Tokens geschenkt; weitere Tokens lassen sich in Paketen nachkaufen.`
            : 'Tokens gibt es in Paketen.'}{' '}
          Dein Guthaben gilt auch bei SKS Lotse. Kein Abo, keine wiederkehrende Zahlung.
        </p>
        <TokenPackages pricing={pricing} />
      </section>
    </SbfPageLayout>
  )
}

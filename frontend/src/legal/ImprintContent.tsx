import { CONTACT_EMAIL } from '../contact'
import { OperatorAddress, ProseSection } from '../components/ProseSection'

// The Impressum's text, shared word for word by both sites (ADR-0067): SKS Lotse's page is
// pages/ImprintPage.tsx, SBF Lotse's sbf/SbfApp.tsx.
export function ImprintContent() {
  return (
    <>
      <ProseSection title="Angaben gemäß § 5 DDG">
        <p>Anbieter der Websites SKS Lotse (sks-lotse.de) und SBF Lotse (sbf-lotse.de):</p>
        <p>
          <OperatorAddress />
        </p>
      </ProseSection>

      <ProseSection title="Umsatzsteuer">
        <p>Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).</p>
      </ProseSection>

      <ProseSection title="Kontakt">
        <p>E-Mail: {CONTACT_EMAIL}</p>
      </ProseSection>

      <ProseSection title="Inhaltlich verantwortlich gemäß § 18 Abs. 2 MStV">
        <p>
          <OperatorAddress />
        </p>
      </ProseSection>

      <ProseSection title="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </p>
      </ProseSection>

      <ProseSection title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
          übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
          eine rechtswidrige Tätigkeit hinweisen.
        </p>
      </ProseSection>

      <ProseSection title="Haftung für Links">
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb
          können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
          stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
      </ProseSection>

      <ProseSection title="Urheberrecht">
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
          des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </ProseSection>
    </>
  )
}

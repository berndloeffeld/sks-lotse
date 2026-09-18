import { ContourBackground } from '../components/ContourBackground'
import { LegalFooter } from '../components/LegalFooter'

export function ImprintPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="relative overflow-hidden py-8">
        <ContourBackground className="h-28" />
        <h1 className="relative font-serif text-3xl text-ink">Impressum</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Angaben gemäß § 5 DDG</h2>
        <p className="text-ink-soft">
          Bernd Löffeld
          <br />
          Gleyeweg 61
          <br />
          10318 Berlin
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Kontakt</h2>
        <p className="text-ink-soft">E-Mail: Bernd.Loeffeld@web.de</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Inhaltlich verantwortlich gemäß § 18 Abs. 2 MStV</h2>
        <p className="text-ink-soft">
          Bernd Löffeld
          <br />
          Gleyeweg 61
          <br />
          10318 Berlin
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Verbraucherstreitbeilegung</h2>
        <p className="text-ink-soft">
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Haftung für Inhalte</h2>
        <p className="text-ink-soft">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
          übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
          eine rechtswidrige Tätigkeit hinweisen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Haftung für Links</h2>
        <p className="text-ink-soft">
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb
          können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
          stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-ink">Urheberrecht</h2>
        <p className="text-ink-soft">
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
          des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </section>

      <LegalFooter />
    </main>
  )
}

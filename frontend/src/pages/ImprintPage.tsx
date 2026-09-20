import { PageLayout } from '../components/PageLayout'

export function ImprintPage() {
  return (
    <PageLayout title="Impressum" nav="public">
      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Angaben gemäß § 5 DDG</h2>
        <p className="text-ink-soft">
          Bernd Löffeld
          <br />
          Gleyeweg 61
          <br />
          10318 Berlin
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Kontakt</h2>
        <p className="text-ink-soft">E-Mail: kontakt@sks-lotse.de</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Inhaltlich verantwortlich gemäß § 18 Abs. 2 MStV</h2>
        <p className="text-ink-soft">
          Bernd Löffeld
          <br />
          Gleyeweg 61
          <br />
          10318 Berlin
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Verbraucherstreitbeilegung</h2>
        <p className="text-ink-soft">
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Haftung für Inhalte</h2>
        <p className="text-ink-soft">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
          übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
          eine rechtswidrige Tätigkeit hinweisen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Haftung für Links</h2>
        <p className="text-ink-soft">
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb
          können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
          stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Urheberrecht</h2>
        <p className="text-ink-soft">
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
          des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </section>
    </PageLayout>
  )
}

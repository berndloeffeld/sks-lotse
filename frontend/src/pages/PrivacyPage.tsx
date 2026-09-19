import { PageLayout } from '../components/PageLayout'

export function PrivacyPage() {
  return (
    <PageLayout title="Datenschutzerklärung" nav="public">
      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Verantwortlicher</h2>
        <p className="text-ink-soft">
          Bernd Löffeld
          <br />
          Gleyeweg 61
          <br />
          10318 Berlin
          <br />
          E-Mail: Bernd.Loeffeld@web.de
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Hosting</h2>
        <p className="text-ink-soft">
          Diese Website sowie die zugehörige Datenbank werden bei Render (Frankfurt, EU) gehostet. Render verarbeitet
          dabei in unserem Auftrag personenbezogene Daten, u. a. Server-Logdaten. Rechtsgrundlage ist Art. 6 Abs. 1 lit.
          f DSGVO (berechtigtes Interesse am zuverlässigen, sicheren Betrieb der Website).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Konto und Anmeldung</h2>
        <p className="text-ink-soft">
          Die Nutzung von SKS Lotse setzt ein Konto voraus. Bei der Anmeldung per E-Mail und Login-Code (OTP)
          verarbeiten wir Ihre E-Mail-Adresse sowie den generierten Code. Der Code ist nur kurze Zeit gültig und wird
          danach automatisch gelöscht. Nach erfolgreicher Anmeldung wird ein Sitzungs-Cookie (JWT) in Ihrem Browser
          gesetzt, das ausschließlich technisch notwendig ist (httpOnly, ohne Zugriff durch JavaScript) und Sie für die
          Dauer Ihrer Sitzung angemeldet hält. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
          Nutzungsvertrags) bzw. lit. f DSGVO (berechtigtes Interesse an einer sicheren Anmeldung). Für den Versand der
          Login-Codes per E-Mail setzen wir den Dienst Resend ein, der dabei in unserem Auftrag tätig wird.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Webanalyse</h2>
        <p className="text-ink-soft">
          Wir nutzen den Analysedienst Umami Cloud, um die Nutzung dieser Website statistisch auszuwerten (z. B.
          Seitenaufrufe). Umami arbeitet cookielos: Es werden keine Cookies gesetzt und keine dauerhafte, geräte- oder
          personenbezogene Kennung gespeichert, mit der Sie über mehrere Besuche hinweg wiedererkannt werden könnten.
          Rechtsgrundlage ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der bedarfsgerechten
          Weiterentwicklung des Angebots. Da keine Wiedererkennung stattfindet, ist hierfür keine Einwilligung nach § 25
          TTDSG erforderlich.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Ihre Rechte</h2>
        <p className="text-ink-soft">
          Sie haben das Recht auf Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO) sowie auf
          Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
          Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Wenden Sie sich
          hierzu an die oben genannte E-Mail-Adresse.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Beschwerderecht</h2>
        <p className="text-ink-soft">
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen
          Daten zu beschweren.
        </p>
      </section>
    </PageLayout>
  )
}

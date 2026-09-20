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
          E-Mail: kontakt@sks-lotse.de
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Hosting</h2>
        <p className="text-ink-soft">
          Diese Website sowie die zugehörige Datenbank werden bei Render (Frankfurt, EU) gehostet. Render verarbeitet
          dabei in unserem Auftrag personenbezogene Daten, u. a. Server-Logdaten. Dabei wird auch Ihre IP-Adresse
          verarbeitet, u. a. um Missbrauch durch übermäßig viele Anfragen zu begrenzen (Rate-Limiting). Schriftarten
          werden von unserem eigenen Server ausgeliefert, nicht von Google oder anderen Dritten. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am zuverlässigen, sicheren Betrieb der Website).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Konto und Anmeldung</h2>
        <p className="text-ink-soft">
          Die Nutzung von SKS Lotse setzt ein Konto voraus. Bei der Anmeldung per E-Mail und Login-Code (OTP)
          verarbeiten wir Ihre E-Mail-Adresse sowie den generierten Code. Der Code ist nur kurze Zeit gültig und wird
          danach automatisch gelöscht. Nach erfolgreicher Anmeldung wird ein Sitzungs-Cookie (JWT) in Ihrem Browser
          gesetzt, das ausschließlich technisch notwendig ist (httpOnly, ohne Zugriff durch JavaScript) und Sie bis zur
          Abmeldung, längstens für sieben Tage, angemeldet hält. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (Erfüllung des Nutzungsvertrags) bzw. lit. f DSGVO (berechtigtes Interesse an einer sicheren Anmeldung). Für
          den Versand der Login-Codes per E-Mail setzen wir den Dienst Resend ein, der dabei in unserem Auftrag tätig
          wird.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Lernfortschritt und Profil</h2>
        <p className="text-ink-soft">
          Wir speichern Ihren Lernfortschritt je Frage (Ihre Selbsteinschätzung und der daraus abgeleitete Lernstand)
          sowie die von Ihnen gewählte Prüfungsvariante und die Themen, die Sie als Fokus markiert haben. Optional
          können Sie in Ihrem Profil Vor- und Nachname sowie eine Anrede angeben; diese Angaben sind freiwillig.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Lernangebots), für freiwillige Angaben Art.
          6 Abs. 1 lit. a DSGVO. Die Daten werden gespeichert, solange Ihr Konto besteht. Sie können Ihr Konto jederzeit
          selbst unter „Profil“ löschen; dabei werden Konto, Lernfortschritt, Fokus-Markierungen und Fragenmeldungen
          vollständig gelöscht. Es findet keine automatisierte Entscheidungsfindung oder Profilbildung im Sinne von Art.
          22 DSGVO statt.
        </p>
        <p className="text-ink-soft">
          Wenn Sie die Prüfungssimulation nutzen, speichern wir zu jeder Prüfung die zufällig zusammengestellten Fragen,
          die von Ihnen eingegebenen Antworttexte, Ihre Selbsteinschätzung je Frage, Start-, Abgabe- und
          Bewertungszeitpunkt sowie die daraus berechnete Punktzahl. Daraus erstellen wir die Statistik in Ihrem Profil.
          Rechtsgrundlage ist ebenfalls Art. 6 Abs. 1 lit. b DSGVO. Diese Daten werden gespeichert, solange Ihr Konto
          besteht; einzelne Prüfungen können Sie jederzeit selbst löschen, mit dem Konto werden alle Prüfungen gelöscht.
          Bitte geben Sie in Ihren Antworten keine personenbezogenen Daten ein.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Fragen melden und Feedback</h2>
        <p className="text-ink-soft">
          Wenn Sie über „Fehler in dieser Frage melden“ eine Frage melden, speichern wir die Frage, die gewählte
          Kategorie, Ihre optionale Anmerkung, den Zeitpunkt sowie die Verknüpfung mit Ihrem Konto, damit wir bei
          Rückfragen antworten können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
          Korrektur und Qualitätssicherung des Fragenkatalogs). Die Meldungen werden gespeichert, solange Ihr Konto
          besteht, und mit dem Konto gelöscht. Bitte geben Sie in der Anmerkung keine personenbezogenen Daten ein.
          Feedback per E-Mail über den Link „Feedback“ geht direkt an die oben genannte Adresse und wird nur zur
          Beantwortung und Verbesserung des Angebots verwendet.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Werbung (Google AdSense)</h2>
        <p className="text-ink-soft">
          Zur Finanzierung des kostenlosen Angebots blenden wir Werbung des Dienstes Google AdSense ein (Google Ireland
          Limited, Gordon House, Barrow Street, Dublin 4, Irland; Muttergesellschaft Google LLC, USA). Dabei werden auf
          Ihrem Gerät Cookies oder ähnliche Technologien gespeichert bzw. ausgelesen, und Daten wie Ihre IP-Adresse,
          Browser- und Geräteinformationen sowie die aufgerufene Seite an Google übermittelt. Google kann diese Daten in
          die USA übermitteln und mit weiteren Daten verknüpfen.
        </p>
        <p className="text-ink-soft">
          Werbung und die zugehörigen Zugriffe auf Ihr Endgerät erfolgen nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit.
          a DSGVO, § 25 Abs. 1 TDDDG). Diese holen wir über die von Google bereitgestellte Consent-Lösung ein, die dem
          Transparency &amp; Consent Framework (TCF) der IAB Europe entspricht. Ihre Einwilligung ist freiwillig; ohne
          sie können Sie SKS Lotse weiterhin vollständig nutzen. Sie können Ihre Entscheidung jederzeit mit Wirkung für
          die Zukunft ändern oder widerrufen, über den Link „Cookie-Einstellungen“ am Seitenende. Weitere Informationen:{' '}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            Wie Google Daten von Websites und Apps nutzt
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Webanalyse</h2>
        <p className="text-ink-soft">
          Wir nutzen den Analysedienst Umami Cloud, um die Nutzung dieser Website statistisch auszuwerten (z. B.
          Seitenaufrufe sowie grobe Nutzungsereignisse wie Anmeldung, Start einer Prüfung oder Bewertung einer Frage,
          ohne Inhalte Ihrer Antworten). Umami arbeitet cookielos: Es werden keine Cookies gesetzt und keine dauerhafte,
          geräte- oder personenbezogene Kennung gespeichert, mit der Sie über mehrere Besuche hinweg wiedererkannt
          werden könnten. Rechtsgrundlage ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der
          bedarfsgerechten Weiterentwicklung des Angebots. Da keine Wiedererkennung stattfindet, ist hierfür keine
          Einwilligung nach § 25 TDDDG erforderlich.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Empfänger und Drittlandübermittlung</h2>
        <p className="text-ink-soft">
          Empfänger Ihrer Daten sind ausschließlich die oben genannten Dienstleister: Render (Hosting), Resend
          (E-Mail-Versand), Umami (Webanalyse) und Google (Werbung). Mit den Dienstleistern, die in unserem Auftrag
          Daten verarbeiten, bestehen Auftragsverarbeitungsverträge. Soweit Anbieter ihren Sitz in den USA haben oder
          Daten dorthin übermitteln, stützt sich die Übermittlung auf einen Angemessenheitsbeschluss der EU-Kommission
          (EU-US Data Privacy Framework) oder auf EU-Standardvertragsklauseln (Art. 44 ff. DSGVO).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Ihre Rechte</h2>
        <p className="text-ink-soft">
          Sie haben das Recht auf Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO) sowie auf
          Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
          Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Eine erteilte
          Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Wenden Sie
          sich hierzu an die oben genannte E-Mail-Adresse.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">Beschwerderecht</h2>
        <p className="text-ink-soft">
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen
          Daten zu beschweren. Zuständig für uns ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit,
          Alt-Moabit 59–61, 10555 Berlin.
        </p>
      </section>
    </PageLayout>
  )
}

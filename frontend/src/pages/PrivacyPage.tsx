import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../contact'
import { PageLayout } from '../components/PageLayout'
import { OperatorAddress, ProseSection } from '../components/ProseSection'

export function PrivacyPage() {
  return (
    <PageLayout title="Datenschutzerklärung" nav="public">
      <ProseSection title="Verantwortlicher">
        <p>
          <OperatorAddress />
          <br />
          E-Mail: {CONTACT_EMAIL}
        </p>
      </ProseSection>

      <ProseSection title="Hosting">
        <p>
          Diese Website sowie die zugehörige Datenbank werden bei Render (Frankfurt, EU) gehostet. Render verarbeitet
          dabei in unserem Auftrag personenbezogene Daten, u. a. Server-Logdaten. Dabei wird auch Ihre IP-Adresse
          verarbeitet, u. a. um Missbrauch durch übermäßig viele Anfragen zu begrenzen (Rate-Limiting). Schriftarten
          werden von unserem eigenen Server ausgeliefert, nicht von Google oder anderen Dritten. Server- und
          Zugriffslogs (u. a. mit Ihrer IP-Adresse) leiten wir zur Fehlersuche und Verfügbarkeitsüberwachung an den
          Logging- und Monitoring-Dienst Better Stack weiter, der die Logs für einen begrenzten Zeitraum speichert und
          zudem die Erreichbarkeit unserer Website überwacht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse am zuverlässigen, sicheren Betrieb der Website).
        </p>
      </ProseSection>

      <ProseSection title="Konto und Anmeldung">
        <p>
          Die Nutzung von SKS Lotse setzt ein Konto voraus. Bei der Anmeldung per E-Mail und Login-Code (OTP)
          verarbeiten wir Ihre E-Mail-Adresse sowie den generierten Code. Der Code ist nur kurze Zeit gültig und wird
          danach automatisch gelöscht. Nach erfolgreicher Anmeldung wird ein Sitzungs-Cookie (JWT) in Ihrem Browser
          gesetzt, das ausschließlich technisch notwendig ist (httpOnly, ohne Zugriff durch JavaScript) und Sie bis zur
          Abmeldung, längstens für sieben Tage, angemeldet hält. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (Erfüllung des Nutzungsvertrags) bzw. lit. f DSGVO (berechtigtes Interesse an einer sicheren Anmeldung). Für
          den Versand der Login-Codes per E-Mail setzen wir den Dienst Resend ein, der dabei in unserem Auftrag tätig
          wird. Bei jedem Login speichern wir außerdem den Zeitpunkt der letzten Anmeldung sowie, welcher Version
          unserer{' '}
          <Link to="/terms" className="underline hover:text-primary">
            AGB
          </Link>{' '}
          Sie zuletzt zugestimmt haben und wann. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (Vertragserfüllung/Zustimmungsnachweis) bzw. lit. f DSGVO (berechtigtes Interesse an einer begrenzten
          Speicherdauer). Bleibt ein Konto länger als zwölf Monate ohne Login, behalten wir uns vor, es und die
          zugehörigen Daten zu löschen; wir kündigen dies nach Möglichkeit vorher per E-Mail an.
        </p>
        <p>
          Nur für Administratoren: Der Admin-Bereich ist zusätzlich durch eine Zwei-Faktor-Anmeldung mit einer
          Authenticator-App geschützt. Dafür speichern wir einen verschlüsselten geheimen Schlüssel, den Zeitpunkt der
          Einrichtung und, welcher Code zuletzt verwendet wurde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse am Schutz der verwalteten Daten). Die Angaben werden gelöscht, wenn die
          Zwei-Faktor-Anmeldung zurückgesetzt oder das Konto gelöscht wird.
        </p>
      </ProseSection>

      <ProseSection title="Lernfortschritt und Profil">
        <p>
          Wir speichern Ihren Lernfortschritt je Frage (Ihre Selbsteinschätzung und der daraus abgeleitete Lernstand)
          sowie die von Ihnen gewählte Prüfungsvariante und die Themen, die Sie als Fokus markiert haben. Optional
          können Sie in Ihrem Profil Vor- und Nachname sowie eine Anrede angeben; diese Angaben sind freiwillig.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Lernangebots), für freiwillige Angaben Art.
          6 Abs. 1 lit. a DSGVO. Die Daten werden gespeichert, solange Ihr Konto besteht. Sie können Ihr Konto jederzeit
          selbst unter „Profil“ löschen; dabei werden Konto, Lernfortschritt, Fokus-Markierungen und Fragenmeldungen
          vollständig gelöscht. Es findet keine automatisierte Entscheidungsfindung oder Profilbildung im Sinne von Art.
          22 DSGVO statt.
        </p>
        <p>
          Wenn Sie die Prüfungssimulation nutzen, speichern wir zu jeder Prüfung die zufällig zusammengestellten Fragen,
          die von Ihnen eingegebenen Antworttexte, Ihre Selbsteinschätzung je Frage, Start-, Abgabe- und
          Bewertungszeitpunkt sowie die daraus berechnete Punktzahl. Daraus erstellen wir die Statistik in Ihrem Profil.
          Rechtsgrundlage ist ebenfalls Art. 6 Abs. 1 lit. b DSGVO. Diese Daten werden gespeichert, solange Ihr Konto
          besteht; einzelne Prüfungen können Sie jederzeit selbst löschen, mit dem Konto werden alle Prüfungen gelöscht.
          Bitte geben Sie in Ihren Antworten keine personenbezogenen Daten ein.
        </p>
      </ProseSection>

      <ProseSection title="Käufe (Werbefrei, Tokens)">
        <p>
          Wenn Sie „Werbefrei“ oder ein Token-Paket erwerben oder Ihnen bei der Anmeldung Tokens geschenkt werden,
          speichern wir dazu: welches Produkt, wie viele Tokens, den gezahlten Betrag (falls vorhanden), wer die
          Gutschrift veranlasst hat und den Zeitpunkt. Der Kauf selbst wird derzeit außerhalb der App abgewickelt; eine
          Zahlungsanbieter-Anbindung besteht noch nicht, daher fallen hierbei aktuell keine Daten an einen
          Zahlungsdienstleister an. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Kaufvertrags), für den
          Anmeldebonus Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung des Nutzungsvertrags). Einträge zu einem
          tatsächlich bezahlten Betrag löschen wir bei einer Kontolöschung nicht sofort, sondern anonymisieren sie (der
          Bezug zu Ihrem Konto wird entfernt, Produkt/Betrag/Datum bleiben bestehen), da handels- und steuerrechtliche
          Aufbewahrungspflichten (§ 147 AO, § 257 HGB) dies für Zahlungsbelege vorschreiben können; Rechtsgrundlage
          hierfür ist Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung). Einträge ohne Geldbetrag, etwa der
          Anmeldebonus, werden bei einer Kontolöschung vollständig gelöscht.
        </p>
      </ProseSection>

      <ProseSection title="Fragen melden und Feedback">
        <p>
          Wenn Sie über „Fehler in dieser Frage melden“ eine Frage melden, speichern wir die Frage, die gewählte
          Kategorie, Ihre optionale Anmerkung, den Zeitpunkt sowie die Verknüpfung mit Ihrem Konto, damit wir bei
          Rückfragen antworten können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
          Korrektur und Qualitätssicherung des Fragenkatalogs). Die Meldungen werden gespeichert, solange Ihr Konto
          besteht, und mit dem Konto gelöscht. Bitte geben Sie in der Anmerkung keine personenbezogenen Daten ein.
          Feedback per E-Mail über den Link „Kontakt“ am Seitenende oder „Feedback“ im Menü geht direkt an die oben
          genannte Adresse und wird nur zur Beantwortung und Verbesserung des Angebots verwendet.
        </p>
      </ProseSection>

      <ProseSection id="werbung" title="Werbung (Google AdSense)">
        <p>
          Zur Finanzierung des kostenlosen Angebots blenden wir Werbung des Dienstes Google AdSense ein (Google Ireland
          Limited, Gordon House, Barrow Street, Dublin 4, Irland; Muttergesellschaft Google LLC, USA). Dabei werden auf
          Ihrem Gerät Cookies oder ähnliche Technologien gespeichert bzw. ausgelesen, und Daten wie Ihre IP-Adresse,
          Browser- und Geräteinformationen sowie die aufgerufene Seite an Google übermittelt. Google kann diese Daten in
          die USA übermitteln und mit weiteren Daten verknüpfen.
        </p>
        <p>
          Werbung und die zugehörigen Zugriffe auf Ihr Endgerät erfolgen nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit.
          a DSGVO, § 25 Abs. 1 TDDDG). Diese holen wir über die von Google bereitgestellte Consent-Lösung ein, die dem
          Transparency &amp; Consent Framework (TCF) der IAB Europe entspricht. Ihre Einwilligung ist freiwillig; ohne
          sie können Sie SKS Lotse weiterhin vollständig nutzen. Sie können Ihre Entscheidung jederzeit mit Wirkung für
          die Zukunft ändern oder widerrufen, über den Link „Cookies“ am Seitenende. Weitere Informationen:{' '}
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
      </ProseSection>

      <ProseSection title="KI-Prüfung Ihrer Antwort (Anthropic)">
        <p>
          Sofern Ihr Konto über ein Token-Guthaben verfügt, können Sie Ihre geschriebene Antwort per Klick von einer KI
          prüfen lassen. Nur dann, und nur für diese eine Frage, übermitteln wir die Frage, die amtliche Musterantwort
          und Ihre eingegebene Antwort an Anthropic (Anthropic, PBC, USA), die daraus einen Bewertungsvorschlag und eine
          kurze Rückmeldung erzeugt. Ihre E-Mail-Adresse, Ihr Name, Ihr Lernfortschritt und frühere Antworten werden
          nicht übermittelt. Ihre eingegebene Antwort sowie die KI-Rückmeldung speichern oder protokollieren wir nicht;
          die Bewertung übernehmen Sie selbst. Zum Schutz vor Missbrauchsversuchen erkennt unser System auffällige
          Antworten automatisiert; löst dieser Schutzmechanismus bei einem Konto wiederholt aus, protokollieren wir ab
          diesem Zeitpunkt zusätzlich Frage und Ergebnis (richtig/falsch) weiterer Prüfungen dieses Kontos — niemals den
          Antworttext oder die KI-Rückmeldung — und speichern kontobezogen, wie oft und wann dieser Mechanismus
          ausgelöst wurde. Bitte geben Sie in Ihre Antwort keine personenbezogenen Daten ein. Rechtsgrundlage für die
          KI-Prüfung ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO), da Sie die Funktion aktiv
          auslösen; für die Missbrauchserkennung Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
          Missbrauchsabwehr). Anthropic verarbeitet die Daten in unserem Auftrag auf Grundlage eines
          Auftragsverarbeitungsvertrags; die Übermittlung in die USA stützt sich auf EU-Standardvertragsklauseln (Art.
          44 ff. DSGVO). Die Aufbewahrung bei Anthropic richtet sich nach deren Vertragsbedingungen für die API-Nutzung.
        </p>
      </ProseSection>

      <ProseSection title="Webanalyse">
        <p>
          Wir nutzen den Analysedienst Umami Cloud, um die Nutzung dieser Website statistisch auszuwerten (z. B.
          Seitenaufrufe sowie grobe Nutzungsereignisse wie Anmeldung, Start einer Prüfung oder Bewertung einer Frage,
          ohne Inhalte Ihrer Antworten). Umami arbeitet cookielos: Es werden keine Cookies gesetzt und keine dauerhafte,
          geräte- oder personenbezogene Kennung gespeichert, mit der Sie über mehrere Besuche hinweg wiedererkannt
          werden könnten. Rechtsgrundlage ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der
          bedarfsgerechten Weiterentwicklung des Angebots. Da keine Wiedererkennung stattfindet, ist hierfür keine
          Einwilligung nach § 25 TDDDG erforderlich.
        </p>
      </ProseSection>

      <ProseSection title="Empfänger und Drittlandübermittlung">
        <p>
          Empfänger Ihrer Daten sind ausschließlich die oben genannten Dienstleister: Render (Hosting), Better Stack
          (Logging und Verfügbarkeitsüberwachung), Resend (E-Mail-Versand), Anthropic (KI-Prüfung, nur bei Nutzung),
          Umami (Webanalyse) und Google (Werbung). Mit den Dienstleistern, die in unserem Auftrag Daten verarbeiten,
          bestehen Auftragsverarbeitungsverträge. Soweit Anbieter ihren Sitz in den USA haben oder Daten dorthin
          übermitteln, stützt sich die Übermittlung auf einen Angemessenheitsbeschluss der EU-Kommission (EU-US Data
          Privacy Framework) oder auf EU-Standardvertragsklauseln (Art. 44 ff. DSGVO).
        </p>
      </ProseSection>

      <ProseSection title="Ihre Rechte">
        <p>
          Sie haben das Recht auf Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO) sowie auf
          Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
          Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Eine erteilte
          Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Wenden Sie
          sich hierzu an die oben genannte E-Mail-Adresse.
        </p>
      </ProseSection>

      <ProseSection title="Beschwerderecht">
        <p>
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen
          Daten zu beschweren. Zuständig für uns ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit,
          Alt-Moabit 59–61, 10555 Berlin.
        </p>
      </ProseSection>

      <p className="text-xs text-ink-soft">Stand: 25. September 2026</p>
    </PageLayout>
  )
}

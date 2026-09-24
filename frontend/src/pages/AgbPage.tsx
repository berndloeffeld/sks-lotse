import { Link } from 'react-router-dom'

import { PageLayout } from '../components/PageLayout'
import { AGB_VERSION_LABEL } from '../legal'

export function AgbPage() {
  return (
    <PageLayout title="AGB" nav="public">
      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">1. Geltungsbereich und Vertragspartner</h2>
        <p className="text-ink-soft">
          Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung von SKS Lotse. Vertragspartner ist Bernd
          Löffeld (Angaben siehe{' '}
          <Link to="/imprint" className="underline hover:text-primary">
            Impressum
          </Link>
          ).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">2. Leistungsbeschreibung</h2>
        <p className="text-ink-soft">
          SKS Lotse ist ein kostenloses Lernangebot zur Vorbereitung auf die theoretische Prüfung des
          Sportküstenschifferscheins (SKS). Grundlage ist der amtliche Fragenkatalog mit Musterantworten, bereitgestellt
          über ELWIS; der Wortlaut wird unverändert übernommen. Wir speichern den individuellen Lernfortschritt.
          Optional steht der „Lotsen-Check" zur Verfügung: ein unverbindlicher, KI-gestützter Bewertungsvorschlag für
          eine selbst formulierte Antwort. Die Bewertung der eigenen Antwort trifft immer der Nutzer selbst.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">3. Registrierung und Nutzerkonto</h2>
        <p className="text-ink-soft">
          Die Nutzung setzt ein Konto voraus, das per E-Mail-Adresse und Login-Code (OTP) angemeldet wird. Der Nutzer
          verpflichtet sich zu wahrheitsgemäßen Angaben und darf nur ein Konto pro Person unterhalten. Die Nutzung setzt
          außerdem die Zustimmung zu diesen AGB voraus: Nach der Anmeldung wird einmalig eine Bestätigung abgefragt (und
          erneut, sobald sich diese AGB inhaltlich ändern). Version und Zeitpunkt der Zustimmung werden zum Konto
          gespeichert.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">4. Kostenpflichtige Zusatzfunktionen</h2>
        <p className="text-ink-soft">
          Die Grundfunktion von SKS Lotse (Fragen üben, amtliche Musterantwort, Lernfortschritt) ist dauerhaft
          kostenlos. Zwei unabhängige, einmalig erwerbbare Erweiterungen stehen optional zur Verfügung:
        </p>
        <ul className="list-disc pl-5 text-ink-soft">
          <li>„Werbefrei" (einmalige Zahlung) entfernt die Werbeeinblendungen dauerhaft für das Konto.</li>
          <li>
            „Tokens" für den Lotsen-Check: ein Token berechtigt zu einem automatisierten KI-Bewertungsvorschlag für eine
            Antwort. Jedes neu angelegte Konto erhält einmalig eine kleine Anzahl Tokens geschenkt; weitere Tokens
            lassen sich in Paketen nachkaufen.
          </li>
        </ul>
        <p className="text-ink-soft">
          Die aktuellen Preise und Paketgrößen werden vor dem Kauf klar mitgeteilt (siehe Startseite und App). Der Kauf
          wird derzeit außerhalb der App abgewickelt und nach Zahlungseingang manuell durch den Betreiber
          gutgeschrieben, bis eine Zahlungsanbieter-Anbindung besteht. Alle genannten Preise sind Endpreise in Euro.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">5. Pflichten der Nutzer</h2>
        <p className="text-ink-soft">
          Der Nutzer verpflichtet sich, das Angebot nicht missbräuchlich zu nutzen, keine automatisierten Massenabfragen
          durchzuführen und in Antworttexten keine personenbezogenen Daten Dritter einzugeben.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">6. Haftungsausschluss für Inhalte</h2>
        <p className="text-ink-soft">
          Der Fragenkatalog ist ein amtliches Werk der zuständigen Behörde; wir übernehmen ihn unverändert, können
          jedoch keine Gewähr für dessen Fehlerfreiheit oder Aktualität übernehmen. Musterantworten und
          Bewertungsvorschläge, auch KI-gestützte, ersetzen keine offizielle Prüfungsvorbereitung und begründen keinen
          Anspruch auf das Bestehen der SKS-Prüfung.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">7. Kommunikation per E-Mail</h2>
        <p className="text-ink-soft">
          Wir sind berechtigt, vertragsbezogene Mitteilungen (z. B. Änderungen dieser AGB, Sicherheits- und
          Wartungshinweise, Ankündigung einer Diensteinstellung oder einer Löschung wegen Inaktivität gemäß Ziffer 8) an
          die im Konto hinterlegte E-Mail-Adresse zu senden.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">8. Laufzeit und Kündigung</h2>
        <p className="text-ink-soft">
          Der Nutzer kann sein Konto jederzeit fristlos selbst löschen (Funktion „Konto löschen" im Profil). Wir können
          einzelne Konten bei einem Verstoß gegen diese AGB fristlos sperren.
        </p>
        <p className="text-ink-soft">
          Wir behalten uns vor, den gesamten Dienst mit einer Vorankündigung von sechs Wochen einzustellen. Wir behalten
          uns außerdem vor, ein Konto zu löschen, über das seit mehr als zwölf Monaten kein Login mehr erfolgt ist; wir
          kündigen dies nach Möglichkeit vorher per E-Mail an die hinterlegte Adresse an.
        </p>
        <p className="text-ink-soft">
          „Werbefrei" und Token-Pakete (Ziffer 4) sind einmalige Käufe digitaler Inhalte, keine Abonnements – es gibt
          keine wiederkehrende Zahlung und daher auch keine laufende Kündigung dafür. Da diese digitalen Inhalte sofort
          nach Zahlungseingang bereitgestellt werden, erlischt das gesetzliche Widerrufsrecht für Verbraucher mit der
          ausdrücklichen Zustimmung zum sofortigen Beginn der Vertragserfüllung und der Kenntnisnahme, dass dadurch das
          Widerrufsrecht erlischt (§ 356 Abs. 5 BGB); diese Zustimmung wird beim Kauf gesondert eingeholt. Geschenkte
          Tokens (Anmeldebonus, Ziffer 4) sind unentgeltlich gewährt und daher von einer Rückerstattung ausgenommen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">9. Haftung</h2>
        <p className="text-ink-soft">
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder
          Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) ist die
          Haftung auf den vertragstypisch vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung ausgeschlossen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">10. Änderungen dieser AGB</h2>
        <p className="text-ink-soft">
          Jede Fassung dieser AGB trägt ein Stand-Datum (siehe Fußzeile dieser Seite). Bei wesentlichen Änderungen,
          insbesondere der Einführung von Zahlungspflichten, holen wir eine erneute aktive Zustimmung ein, bevor der
          Nutzer den Dienst weiter nutzen kann.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl text-primary">11. Schlussbestimmungen</h2>
        <p className="text-ink-soft">
          Es gilt deutsches Recht. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen
          Bestimmungen davon unberührt.
        </p>
      </section>

      <p className="text-xs text-ink-soft">Stand: {AGB_VERSION_LABEL}</p>
    </PageLayout>
  )
}

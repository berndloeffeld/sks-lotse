import { Link } from 'react-router-dom'

import { PageLayout } from '../components/PageLayout'
import { ProseSection } from '../components/ProseSection'
import { AGB_VERSION_LABEL } from '../legal'

export function AgbPage() {
  return (
    <PageLayout title="AGB" nav="public">
      <ProseSection title="1. Geltungsbereich und Vertragspartner">
        <p>
          Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung von SKS Lotse. Vertragspartner ist Bernd
          Löffeld (Angaben siehe{' '}
          <Link to="/imprint" className="underline hover:text-primary">
            Impressum
          </Link>
          ).
        </p>
      </ProseSection>

      <ProseSection title="2. Leistungsbeschreibung">
        <p>
          SKS Lotse ist ein kostenloses Lernangebot zur Vorbereitung auf die theoretische Prüfung des
          Sportküstenschifferscheins (SKS). Grundlage ist der amtliche Fragenkatalog mit Musterantworten, bereitgestellt
          über ELWIS; der Wortlaut wird unverändert übernommen. Wir speichern den individuellen Lernfortschritt.
          Optional steht der „Lotsen-Check" zur Verfügung: ein unverbindlicher, KI-gestützter Bewertungsvorschlag für
          eine selbst formulierte Antwort. Die Bewertung der eigenen Antwort trifft immer der Nutzer selbst.
        </p>
        <p>
          Wir bemühen uns um eine möglichst hohe Verfügbarkeit des Dienstes. Ein Anspruch auf unterbrechungsfreie
          Verfügbarkeit besteht jedoch nicht, etwa bei Wartungsarbeiten oder Störungen bei eingesetzten Dienstleistern.
          Kann ein Lotsen-Check aus technischen Gründen nicht durchgeführt werden, wird dafür kein Token verbraucht.
        </p>
      </ProseSection>

      <ProseSection title="3. Registrierung und Nutzerkonto">
        <p>
          Die Nutzung setzt ein Konto voraus, das per E-Mail-Adresse und Login-Code (OTP) angemeldet wird. Der Nutzer
          verpflichtet sich zu wahrheitsgemäßen Angaben und darf nur ein Konto pro Person unterhalten. Die Nutzung setzt
          außerdem die Zustimmung zu diesen AGB voraus: Nach der Anmeldung wird einmalig eine Bestätigung abgefragt (und
          erneut, sobald sich diese AGB inhaltlich ändern). Version und Zeitpunkt der Zustimmung werden zum Konto
          gespeichert.
        </p>
      </ProseSection>

      <ProseSection title="4. Kostenpflichtige Zusatzfunktionen">
        <p>
          Die Grundfunktion von SKS Lotse (Fragen üben, amtliche Musterantwort, Lernfortschritt) ist dauerhaft
          kostenlos. Zwei unabhängige, einmalig erwerbbare Erweiterungen stehen optional zur Verfügung:
        </p>
        <ul className="list-disc pl-5">
          <li>„Werbefrei" (einmalige Zahlung) entfernt die Werbeeinblendungen dauerhaft für das Konto.</li>
          <li>
            „Tokens" für den Lotsen-Check: ein Token berechtigt zu einem automatisierten KI-Bewertungsvorschlag für eine
            Antwort. Jedes neu angelegte Konto erhält einmalig eine kleine Anzahl Tokens geschenkt; weitere Tokens
            lassen sich in Paketen nachkaufen.
          </li>
        </ul>
        <p>
          Die aktuellen Preise und Paketgrößen werden vor dem Kauf klar mitgeteilt (siehe Startseite und App). Alle
          genannten Preise sind Endpreise in Euro; gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.
        </p>
        <p>
          Token-Pakete kauft der angemeldete Nutzer direkt in der App. Nach der Auswahl eines Pakets und der Bestätigung
          der Angaben zum Widerrufsrecht (Ziffer 8) wird er zur Zahlung an unseren Zahlungsdienstleister Stripe
          weitergeleitet, der die Zahlung abwickelt und dafür die dort angebotenen Zahlungsmethoden bereitstellt. Der
          Kaufvertrag kommt mit erfolgreicher Zahlung zustande; die Tokens werden dem Konto danach automatisch
          gutgeschrieben, in der Regel innerhalb weniger Sekunden. Bei einer verzögerten Zahlungsmethode erfolgt die
          Gutschrift erst nach Zahlungseingang. „Werbefrei" wird derzeit noch nicht zum Kauf angeboten.
        </p>
      </ProseSection>

      <ProseSection title="5. Pflichten der Nutzer">
        <p>
          Der Nutzer verpflichtet sich, das Angebot nicht missbräuchlich zu nutzen, keine automatisierten Massenabfragen
          durchzuführen und in Antworttexten keine personenbezogenen Daten Dritter einzugeben.
        </p>
      </ProseSection>

      <ProseSection title="6. Haftungsausschluss für Inhalte">
        <p>
          Der Fragenkatalog ist ein amtliches Werk der zuständigen Behörde; wir übernehmen ihn unverändert, können
          jedoch keine Gewähr für dessen Fehlerfreiheit oder Aktualität übernehmen. Musterantworten und
          Bewertungsvorschläge, auch KI-gestützte, ersetzen keine offizielle Prüfungsvorbereitung und begründen keinen
          Anspruch auf das Bestehen der SKS-Prüfung. Bei Abweichungen gilt die auf ELWIS veröffentlichte amtliche
          Fassung des Fragenkatalogs.
        </p>
      </ProseSection>

      <ProseSection title="7. Kommunikation per E-Mail">
        <p>
          Wir sind berechtigt, vertragsbezogene Mitteilungen (z. B. Änderungen dieser AGB, Sicherheits- und
          Wartungshinweise, Kaufbestätigungen, Ankündigung einer Diensteinstellung oder einer Löschung wegen Inaktivität
          gemäß Ziffer 8) an die im Konto hinterlegte E-Mail-Adresse zu senden. Werbe-E-Mails oder Newsletter versenden
          wir nicht.
        </p>
      </ProseSection>

      <ProseSection title="8. Laufzeit und Kündigung">
        <p>
          Der Nutzer kann sein Konto jederzeit fristlos selbst löschen (Funktion „Konto löschen" im Profil). Wir können
          einzelne Konten bei einem Verstoß gegen diese AGB fristlos sperren.
        </p>
        <p>
          Wir behalten uns vor, den gesamten Dienst mit einer Vorankündigung von sechs Wochen einzustellen. Wir behalten
          uns außerdem vor, ein Konto zu löschen, über das seit mehr als zwölf Monaten kein Login mehr erfolgt ist; wir
          kündigen dies nach Möglichkeit vorher per E-Mail an die hinterlegte Adresse an. Bei einer dauerhaften
          Einstellung des Dienstes erlöschen noch nicht verbrauchte Tokens; ein Anspruch auf Fortführung des Angebots
          oder auf Erstattung besteht nicht, soweit gesetzlich zulässig.
        </p>
        <p>
          „Werbefrei" und Token-Pakete (Ziffer 4) sind einmalige Käufe digitaler Inhalte, keine Abonnements – es gibt
          keine wiederkehrende Zahlung und daher auch keine laufende Kündigung dafür. Da diese digitalen Inhalte sofort
          nach Zahlungseingang bereitgestellt werden, erlischt das gesetzliche Widerrufsrecht für Verbraucher mit der
          ausdrücklichen Zustimmung zum sofortigen Beginn der Vertragserfüllung und der Kenntnisnahme, dass dadurch das
          Widerrufsrecht erlischt (§ 356 Abs. 5 BGB); diese Zustimmung wird beim Kauf durch ein gesondertes
          Bestätigungsfeld vor der Zahlung eingeholt; ohne sie ist der Kauf nicht möglich. Geschenkte Tokens
          (Anmeldebonus, Ziffer 4) sind unentgeltlich gewährt und daher von einer Rückerstattung ausgenommen. Gekaufte
          Tokens verfallen nicht durch bloßen Zeitablauf; mit der Löschung des Kontos, auch nach dieser Ziffer,
          erlöschen jedoch die noch nicht verbrauchten Tokens, ohne dass dafür ein Erstattungsanspruch entsteht.
        </p>
      </ProseSection>

      <ProseSection title="9. Haftung">
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder
          Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) ist die
          Haftung auf den vertragstypisch vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung ausgeschlossen.
        </p>
      </ProseSection>

      <ProseSection title="10. Änderungen dieser AGB">
        <p>
          Jede Fassung dieser AGB trägt ein Stand-Datum (siehe Fußzeile dieser Seite). Bei wesentlichen Änderungen,
          insbesondere der Einführung von Zahlungspflichten, holen wir eine erneute aktive Zustimmung ein, bevor der
          Nutzer den Dienst weiter nutzen kann.
        </p>
      </ProseSection>

      <ProseSection title="11. Schlussbestimmungen">
        <p>
          Es gilt deutsches Recht; zwingende Verbraucherschutzvorschriften des Staates, in dem der Nutzer seinen
          gewöhnlichen Aufenthalt hat, bleiben unberührt. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die
          Wirksamkeit der übrigen Bestimmungen davon unberührt.
        </p>
      </ProseSection>

      <p className="text-xs text-ink-soft">Stand: {AGB_VERSION_LABEL}</p>
    </PageLayout>
  )
}

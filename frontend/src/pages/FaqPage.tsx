import { PageLayout } from '../components/PageLayout'

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Woher stammen die Fragen und Musterantworten?',
    answer:
      'Aus dem amtlichen Fragenkatalog SKS der Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über ELWIS. Wir verändern den Wortlaut nicht.',
  },
  {
    question: 'Was ist der Unterschied zwischen „Segeln und Motor“ und „Motor“?',
    answer:
      'Die Prüfung gibt es in zwei Varianten, je nach Antriebsart. Du legst nur eine davon ab. Wähle deine Variante in der Lernübersicht oder im Profil, dann siehst du nur die passenden Fragen.',
  },
  {
    question: 'Wie funktioniert das Lernen?',
    answer:
      'Du liest die Frage, formulierst die Antwort im Kopf oder schreibst sie auf, vergleichst sie mit der Musterantwort und bewertest dich selbst: richtig, teilweise richtig oder falsch. Daraus ergibt sich dein Lernstand.',
  },
  {
    question: 'Wann gilt eine Frage als „gelernt“?',
    answer:
      'Wenn du sie über mehrere Tage verteilt richtig beantwortet hast und wir davon ausgehen, dass du sie noch weißt. Mehrmals direkt hintereinander „richtig“ zu klicken bringt kaum etwas – entscheidend ist, dass du an verschiedenen Tagen wiederkommst.',
  },
  {
    question: 'Warum sinkt mein Lernstand, wenn ich länger pausiere?',
    answer:
      'Was man nicht wiederholt, vergisst man. Wir schätzen für jede Frage, wie lange du sie voraussichtlich behältst. Läuft diese Zeit ab, gilt die Frage wieder als offen und kommt in der Übung zurück – so bleibt dein Lernstand ein ehrlicher Hinweis auf die Prüfungsreife.',
  },
  {
    question: 'Was ist die KI-Antwortprüfung?',
    answer:
      'Für freigeschaltete Konten schlägt eine KI zu deiner Antwort eine Bewertung samt Begründung vor. Die endgültige Bewertung triffst weiterhin du selbst.',
  },
  {
    question: 'Was sind Fokus-Themen?',
    answer:
      'Mit dem Stern in der Lernübersicht markierst du Themen, auf die du dich gerade konzentrieren willst. Dort siehst du gesammelt, wie weit du bei genau diesen Themen bist.',
  },
  {
    question: 'Was ist die Prüfungssimulation?',
    answer:
      'Ein zufälliger Fragebogen mit 30 Fragen und 90 Minuten Zeit, ohne Hilfen. Danach bewertest du dich Frage für Frage. Die praktische Kartenaufgabe wird nicht simuliert.',
  },
  {
    question: 'Kann ich Antworten einsprechen?',
    answer:
      'Ja, in Chromium-basierten Browsern (z. B. Chrome, Edge). Die Sprache wird lokal im Browser in Text umgewandelt.',
  },
  {
    question: 'Was passiert mit meinen Daten?',
    answer: 'Details stehen in der Datenschutzerklärung. Du kannst dein Konto jederzeit im Profil löschen.',
  },
]

export function FaqPage() {
  return (
    <PageLayout title="Häufige Fragen" nav="public">
      {FAQ.map(({ question, answer }) => (
        <section key={question} className="flex flex-col gap-2">
          <h2 className="font-serif text-xl text-primary">{question}</h2>
          <p className="text-ink-soft">{answer}</p>
        </section>
      ))}
    </PageLayout>
  )
}

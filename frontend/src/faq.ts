// Shared with FaqPage (full list) and LandingPage (teaser excerpt) — ids give
// each entry a stable /faq#<id> anchor for deep-linking from elsewhere. An answer
// links to another page with `[text](/path)`; FaqAnswer renders that as a Link.
export const FAQ: { id: string; question: string; answer: string }[] = [
  {
    id: 'quelle',
    question: 'Woher stammen die Fragen und Musterantworten?',
    answer:
      'Aus dem amtlichen Fragenkatalog SKS der Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über ELWIS. Wir verändern den Wortlaut nicht.',
  },
  {
    id: 'varianten',
    question: 'Was ist der Unterschied zwischen „Segeln und Motor" und „Motor"?',
    answer:
      'Die Prüfung gibt es in zwei Varianten, je nach Antriebsart. Du legst nur eine davon ab. Wähle deine Variante in der Lernübersicht oder im Profil, dann siehst du nur die passenden Fragen.',
  },
  {
    id: 'lernen',
    question: 'Wie funktioniert das Lernen?',
    answer:
      'Du liest die Frage, formulierst die Antwort im Kopf oder schreibst sie auf, vergleichst sie mit der Musterantwort und bewertest dich selbst: richtig, teilweise richtig oder falsch. Daraus ergibt sich dein Lernstand.',
  },
  {
    id: 'lernmodi',
    question: 'Welche Lernmodi gibt es?',
    answer:
      'Nach Thema: ein Fachgebiet nach dem anderen. Fokus: deine Stern-Themen, was du am längsten nicht richtig hattest, kommt zuerst. Auffrischen: 20 Fragen, die du schon sicher konntest und die möglicherweise verblasst sind oder bald verblassen könnten. Alle drei findest du unter [Lernen](/learn).',
  },
  {
    id: 'gelernt',
    question: 'Wann gilt eine Frage als „gelernt"?',
    answer:
      'Wenn du sie über mehrere Tage verteilt richtig beantwortet hast und wir davon ausgehen, dass du sie noch weißt. Mehrmals direkt hintereinander „richtig" zu klicken bringt kaum etwas – entscheidend ist, dass du an verschiedenen Tagen wiederkommst.',
  },
  {
    id: 'lernstand-sinkt',
    question: 'Warum sinkt mein Lernstand, wenn ich länger pausiere?',
    answer:
      'Was man nicht wiederholt, vergisst man. Wir schätzen für jede Frage, wie lange du sie voraussichtlich behältst. Läuft diese Zeit ab, gilt die Frage wieder als offen und kommt in der Übung zurück – so bleibt dein Lernstand ein ehrlicher Hinweis auf die Prüfungsreife. Mit dem Modus „Auffrischen“ holst du gezielt Fragen zurück, die möglicherweise verblasst sind oder bald verblassen könnten.',
  },
  {
    id: 'tokens',
    question: 'Was ist ein Token?',
    answer:
      'Ein Token ist die Einheit, mit der der Lotsen-Check (die KI-Antwortprüfung) bezahlt wird: 1 Token = 1 automatisch bewertete Antwort. Bei der Anmeldung bekommst du ein paar Tokens geschenkt; weitere lassen sich in Paketen nachkaufen; die aktuellen Pakete und Preise stehen unter [Preise und Shop](/pricing). Tokens verfallen nicht durch Zeitablauf, gehen aber mit deinem Konto verloren, wenn es gelöscht wird – auch wenn wir es nach zwölf Monaten ohne Login löschen (das kündigen wir vorher per E-Mail an).',
  },
  {
    id: 'tokens-kaufen',
    question: 'Wie kaufe ich Tokens und wie zahle ich?',
    answer:
      'Melde dich an, öffne den Shop, wähle ein Paket und bestätige, dass die Tokens sofort bereitgestellt werden. Danach wirst du zur Zahlung an unseren Zahlungsanbieter weitergeleitet. Die Tokens werden dir nach der Zahlung automatisch gutgeschrieben. Es ist ein Einmalkauf ohne Abo. Weil die Tokens sofort bereitgestellt werden, erlischt das Widerrufsrecht mit deiner ausdrücklichen Zustimmung; Näheres in den [AGB](/terms).',
  },
  {
    id: 'ki-pruefung',
    question: 'Was ist die KI-Antwortprüfung?',
    answer:
      'Solange dein Token-Guthaben reicht (1 Token pro Antwort), schlägt eine KI zu deiner Antwort eine Bewertung samt Begründung vor. Die endgültige Bewertung triffst weiterhin du selbst.',
  },
  {
    id: 'fokus-themen',
    question: 'Was sind Fokus-Themen?',
    answer:
      'Mit dem Stern in der Lernübersicht markierst du Themen, auf die du dich gerade konzentrieren willst. Dort siehst du gesammelt, wie weit du bei genau diesen Themen bist, und mit „Fokus starten“ übst du alle offenen Fragen dieser Themen, die älteste richtige Antwort zuerst.',
  },
  {
    id: 'pruefungssimulation',
    question: 'Was ist die Prüfungssimulation?',
    answer:
      'Ein zufälliger Fragebogen mit 30 Fragen und 90 Minuten Zeit, ohne Hilfen. Die Fragen sind wie von den Prüfungsausschüssen veröffentlicht auf die Fächer aufgeteilt (Navigation 9, Schifffahrtsrecht 7, Wetterkunde 5, Seemannschaft 9). Danach bewertest du dich Frage für Frage. Fragen, die du im Examen richtig beantwortet hast, zählen für deinen Lernstand wie Praxis-Fragen – das macht das Examen zu einem echten Test deines aktuellen Wissensstands. Die praktische Kartenaufgabe wird nicht simuliert.',
  },
  {
    id: 'daten',
    question: 'Was passiert mit meinen Daten?',
    answer:
      'Details stehen in der [Datenschutzerklärung](/privacy). Du kannst dein Konto jederzeit im [Profil](/profile) löschen.',
  },
  {
    id: 'sbf-see',
    question: 'Brauche ich den SBF See, bevor ich mit der SKS anfangen kann?',
    answer:
      'Ja. Der Sportbootführerschein See (SBF See) ist Voraussetzung für die SKS. SKS Lotse deckt nur die SKS-Theorie ab – den kompletten Ablauf von SBF See über die SKS-Theorie- bis zur Praxisprüfung erklären wir unter [So läuft die SKS-Prüfung ab](/exam-process).',
  },
  {
    id: 'praxis',
    question: 'Bereitet SKS Lotse auch auf die praktische Prüfung vor?',
    answer:
      'Nein, SKS Lotse deckt ausschließlich den amtlichen Fragenkatalog für die SKS-Theorieprüfung ab. Die praktische Ausbildung und Prüfung – zum Beispiel für Manöver auf einer Segelyacht – holst du dir bei einer Segelschule. Mehr dazu unter [So läuft die SKS-Prüfung ab](/exam-process).',
  },
]

export type FaqAnswerPart = { text: string; to?: string }

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

// An answer split into plain text and in-app links (`[text](/path)` — only site-relative paths).
export function faqAnswerParts(answer: string): FaqAnswerPart[] {
  const parts: FaqAnswerPart[] = []
  let last = 0
  for (const match of answer.matchAll(LINK)) {
    if (match.index > last) parts.push({ text: answer.slice(last, match.index) })
    parts.push({ text: match[1], to: match[2] })
    last = match.index + match[0].length
  }
  if (last < answer.length) parts.push({ text: answer.slice(last) })
  return parts
}

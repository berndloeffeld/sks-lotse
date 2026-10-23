// The SBF site's FAQ (/faq and the start page's excerpt), like src/faq.ts for SKS Lotse: ids give
// each entry a stable /faq#<id> anchor, and an answer links with `[text](/path)` (FaqAnswer).
// While VITE_SBF is "off" (ADR-0067) it describes the site as being built, not what it will offer.
export const SBF_FAQ: { id: string; question: string; answer: string }[] = [
  {
    id: 'was',
    question: 'Was ist SBF Lotse?',
    answer:
      'Eine Web-App für die Theorieprüfung zum Sportbootführerschein (SBF), aus derselben Werkstatt wie SKS Lotse. Sie ist im Aufbau. Als Erstes kommen die 15 amtlichen Navigationsaufgaben für den SBF See: Aufgabe für Aufgabe deine Antwort schreiben, mit dem amtlichen Ergebnis vergleichen und am Ende sehen, ob es nach dem Bewertungsschlüssel zum Bestehen gereicht hätte.',
  },
  {
    id: 'navigationsaufgabe',
    question: 'Was ist die Navigationsaufgabe im SBF See?',
    answer:
      'Ein Teil der theoretischen Prüfung für den SBF See, zusätzlich zum Fragebogen: Auf der Übungskarte D49 (Mündungen der Jade, Weser und Elbe) löst du 9 Teilaufgaben, etwa Kurse, Peilungen, Distanzen und Positionen. Jede richtige Antwort gibt einen Punkt, bestanden ist die Navigationsaufgabe ab 7 von 9 Punkten. Folgt ein Fehler nur aus einem früheren, zählt die Antwort trotzdem als richtig.',
  },
  {
    id: 'quelle',
    question: 'Woher stammen die Aufgaben?',
    answer:
      'Aus dem amtlichen Fragenkatalog für den Sportbootführerschein See der Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über ELWIS. Wir verändern den Wortlaut nicht.',
  },
  {
    id: 'konto',
    question: 'Brauche ich ein Konto?',
    answer:
      'Nein. Ein Konto gibt es auf SBF Lotse noch nicht, und es wird auch nichts gespeichert. Konten, die übrigen Prüfungsfragen und der Lotsen-Check, der dir eine Bewertung deiner Antwort vorschlägt, kommen später.',
  },
  {
    id: 'kosten',
    question: 'Was kostet SBF Lotse?',
    answer: 'Nichts. SBF Lotse ist kostenlos und ohne Werbung.',
  },
  {
    id: 'sks',
    question: 'Wie geht es nach dem SBF See weiter?',
    answer:
      'Wer auch in Küstengewässern Yachten führen will, macht als Nächstes den Sportküstenschifferschein (SKS); der SBF See ist dafür Voraussetzung. Für die SKS-Theorie gibt es SKS Lotse auf sks-lotse.de, mit dem kompletten amtlichen SKS-Fragenkatalog.',
  },
]

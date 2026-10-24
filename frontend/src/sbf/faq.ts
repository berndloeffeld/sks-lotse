// The SBF site's FAQ (/faq and the start page's excerpt), like src/sks/faq.ts for SKS Lotse: ids give
// each entry a stable /faq#<id> anchor, and an answer links with `[text](/path)` (FaqAnswer).
// Two entries depend on the build: while VITE_SBF is "off" (ADR-0067) they describe the site as being
// built, with "on" what guests can do now (ADR-0068).
export interface SbfFaqEntry {
  id: string
  question: string
  answer: string
}

const WHAT_SOON: SbfFaqEntry = {
  id: 'was',
  question: 'Was ist SBF Lotse?',
  answer:
    'Eine Web-App für die Theorieprüfung zum Sportbootführerschein (SBF), aus derselben Werkstatt wie SKS Lotse. Sie ist im Aufbau. Als Erstes kommen die 15 amtlichen Navigationsaufgaben für den SBF See: Aufgabe für Aufgabe deine Antwort schreiben, mit dem amtlichen Ergebnis vergleichen und am Ende sehen, ob es nach dem Bewertungsschlüssel zum Bestehen gereicht hätte.',
}

const WHAT_OPEN: SbfFaqEntry = {
  id: 'was',
  question: 'Was ist SBF Lotse?',
  answer:
    'Eine Web-App für die Theorieprüfung zum Sportbootführerschein (SBF), aus derselben Werkstatt wie SKS Lotse. Die 15 amtlichen [Navigationsaufgaben](/navigation) für den SBF See kannst du schon üben: Teilaufgabe für Teilaufgabe deine Antwort schreiben, mit dem amtlichen Ergebnis vergleichen und am Ende sehen, ob es nach dem Bewertungsschlüssel zum Bestehen gereicht hätte. Weiteres ist im Aufbau.',
}

const TOLERANCE: SbfFaqEntry = {
  id: 'toleranz',
  question: 'Woher kommen die Toleranzen bei den Ergebnissen?',
  answer:
    'Der amtliche Katalog nennt nur das Ergebnis, keine Toleranzen. Die Toleranzen, die SBF Lotse dazu angibt, stammen von uns und folgen der üblichen Prüfungspraxis, etwa ±1° bei Kursen und Peilungen oder ±0,2′ bei Positionen. Sie sind nicht amtlich und deshalb auch so gekennzeichnet; maßgeblich ist, was die Prüfungskommission gelten lässt.',
}

const COMMON: SbfFaqEntry[] = [
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
    id: 'sks',
    question: 'Wie geht es nach dem SBF See weiter?',
    answer:
      'Wer auch in Küstengewässern Yachten führen will, macht als Nächstes den Sportküstenschifferschein (SKS); der SBF See ist dafür Voraussetzung. Für die SKS-Theorie gibt es SKS Lotse auf sks-lotse.de, mit dem kompletten amtlichen SKS-Fragenkatalog.',
  },
]

// Account and cost, as long as SBF Lotse has no accounts.
const ACCOUNT_SOON: SbfFaqEntry[] = [
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
]

// With accounts (VITE_SBF_ACCOUNTS=on, ADR-0070, ADR-0071).
const ACCOUNT_OPEN: SbfFaqEntry[] = [
  {
    id: 'konto',
    question: 'Brauche ich ein Konto?',
    answer:
      'Zum Üben nicht. Mit einem kostenlosen Konto werden deine Läufe gespeichert, du setzt sie auf jedem Gerät fort, und der Lotsen-Check schlägt dir für eine Teilaufgabe eine Bewertung vor. Hast du ein Konto bei SKS Lotse, gilt es auch hier.',
  },
  {
    id: 'kosten',
    question: 'Was kostet SBF Lotse?',
    answer:
      'Üben und Speichern sind kostenlos und ohne Werbung. Nur der Lotsen-Check kostet Tokens: 2 je Teilaufgabe. Zum Start gibt es Tokens geschenkt, weitere gibt es in Paketen ohne Abo, siehe [Preise](/pricing).',
  },
]

// The FAQ of the build: with the Navigationsaufgaben, the note on the own tolerances follows the source;
// with accounts, what an account and the Lotsen-Check bring.
export function sbfFaq(open: boolean, accounts = false): SbfFaqEntry[] {
  const account = accounts ? ACCOUNT_OPEN : ACCOUNT_SOON
  const [sks] = COMMON.slice(-1)
  const general = COMMON.slice(0, -1)
  return open
    ? [WHAT_OPEN, ...general.slice(0, 2), TOLERANCE, ...general.slice(2), ...account, sks]
    : [WHAT_SOON, ...general, ...account, sks]
}

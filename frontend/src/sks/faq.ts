// Shared with FaqPage (full list) and LandingPage (teaser excerpt) — ids give
// each entry a stable /faq#<id> anchor for deep-linking from elsewhere. An answer
// links to another page with `[text](/path)`; FaqAnswer renders that as a Link.
export const FAQ: { id: string; question: string; answer: string }[] = [
  {
    id: 'quelle',
    question: 'Woher stammen die Fragen und amtlichen Antworten?',
    answer:
      'Aus dem amtlichen Fragenkatalog SKS der Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über ELWIS. Wir verändern den Wortlaut nicht.',
  },
  {
    id: 'varianten',
    question: 'Was ist der Unterschied zwischen „Segeln und Motor“ und „Motor“?',
    answer:
      'Die Prüfung gibt es in zwei Varianten, je nach Antriebsart. Du legst nur eine davon ab. Wähle deine Variante in der Lernübersicht oder im Profil, dann siehst du nur die passenden Fragen.',
  },
  {
    id: 'lernen',
    question: 'Wie funktioniert das Lernen?',
    answer:
      'Du liest die Frage, formulierst die Antwort im Kopf oder schreibst sie auf, vergleichst sie mit der amtlichen Antwort und bewertest dich selbst: richtig, teilweise richtig oder falsch. Daraus ergibt sich dein Lernstand.',
  },
  {
    id: 'ohne-anmeldung',
    question: 'Kann ich auch ohne Anmeldung lernen?',
    answer:
      'Ja. Unter [Lernen](/learn) sind alle Fragen des amtlichen Katalogs nach Themen frei zum Üben: Frage lesen, Antwort aufschreiben, mit der amtlichen Antwort vergleichen. Ebenso die amtlichen Kartenaufgaben, Aufgabe für Aufgabe mit der amtlichen Lösung. Auch ohne Anmeldung bewertest du dich selbst und siehst am Ende der Runde, wie sie lief; bei uns wird aber nichts gespeichert (das Formblatt der Kartenaufgaben bleibt nur in deinem Browser), und es gibt keinen Lernstand. Mit Anmeldung behältst du deinen Lernstand auf jedem Gerät und bekommst Fokus, Auffrischen, die Probeprüfung und den Lotsen-Check.',
  },
  {
    id: 'app',
    question: 'Gibt es SKS Lotse als App?',
    answer:
      'Ja, als Web-App: SKS Lotse läuft im Browser auf Handy, Tablet und Computer, ohne App Store und ohne Download. Auf den Startbildschirm legst du sie so: auf dem iPhone oder iPad in Safari über „Teilen“ und „Zum Home-Bildschirm“, auf Android in Chrome über das Menü und „Zum Startbildschirm hinzufügen“ oder „App installieren“. Danach öffnet sie sich wie eine App im eigenen Fenster. Mit Anmeldung ist dein Lernstand auf allen Geräten derselbe.',
  },
  {
    id: 'lernmodi',
    question: 'Welche Lernmodi gibt es?',
    answer:
      'Nach Thema: ein Thema nach dem anderen. Fokus: deine Stern-Themen, was du am längsten nicht richtig hattest, kommt zuerst. Auffrischen: bis zu 20 Fragen, die du schon sicher konntest und die möglicherweise verblasst sind oder bald verblassen könnten. Alle drei findest du unter [Lernen](/learn).',
  },
  {
    id: 'gelernt',
    question: 'Wann gilt eine Frage als „gelernt“?',
    answer:
      'Wenn du sie über mehrere Tage verteilt richtig beantwortet hast und wir davon ausgehen, dass du sie noch weißt. Mehrmals direkt hintereinander „richtig“ zu klicken bringt kaum etwas – entscheidend ist, dass du an verschiedenen Tagen wiederkommst. Das Prinzip dahinter erklärt [So lernst du mit dem Karteikarten-Prinzip](/learning-method).',
  },
  {
    id: 'lernstand-sinkt',
    question: 'Warum sinkt mein Lernstand, wenn ich länger pausiere?',
    answer:
      'Was man nicht wiederholt, vergisst man. Wir schätzen für jede Frage, wie lange du sie voraussichtlich behältst. Läuft diese Zeit ab, gilt die Frage wieder als offen und kommt in der Übung zurück – so bleibt dein Lernstand ein ehrlicher Hinweis auf die Prüfungsreife. Mit dem Modus „Auffrischen“ holst du gezielt Fragen zurück, die möglicherweise verblasst sind oder bald verblassen könnten. Mehr zur Idee dahinter unter [Lernmethode](/learning-method).',
  },
  {
    id: 'tokens',
    question: 'Was ist ein Token?',
    answer:
      'Ein Token ist die Einheit, mit der der Lotsen-Check (die KI-Antwortprüfung) bezahlt wird: 1 Token je Frage aus dem Katalog, 2 Tokens je Aufgabe einer Kartenaufgabe (dort rechnet der Lotse deine Werte nach und sucht deinen Fehler); der Preis und dein Guthaben stehen jeweils auf dem Knopf. Bei der Anmeldung bekommst du ein paar Tokens geschenkt; weitere lassen sich in Paketen nachkaufen; die aktuellen Pakete und Preise stehen unter [Preise](/pricing). Tokens verfallen nicht durch Zeitablauf, gehen aber mit deinem Konto verloren, wenn es gelöscht wird – auch wenn wir es nach zwölf Monaten ohne Login löschen (das kündigen wir nach Möglichkeit vorher per E-Mail an).',
  },
  {
    id: 'tokens-kaufen',
    question: 'Wie kaufe ich Tokens und wie zahle ich?',
    answer:
      'Melde dich an, öffne die [Preise](/pricing), wähle ein Paket und bestätige, dass die Tokens sofort bereitgestellt werden. Danach wirst du zur Zahlung an unseren Zahlungsanbieter weitergeleitet. Die Tokens werden dir nach der Zahlung automatisch gutgeschrieben. Es ist ein Einmalkauf ohne Abo. Weil die Tokens sofort bereitgestellt werden, erlischt das Widerrufsrecht mit deiner ausdrücklichen Zustimmung; Näheres in den [AGB](/terms).',
  },
  {
    id: 'ki-pruefung',
    question: 'Was ist der Lotsen-Check?',
    answer:
      'Der Lotsen-Check ist die KI-Antwortprüfung. Solange dein Token-Guthaben reicht (1 Token je Katalogfrage, 2 je Aufgabe einer Kartenaufgabe), schlägt eine KI zu deiner Antwort eine Bewertung samt Begründung vor. Die endgültige Bewertung triffst weiterhin du selbst.',
  },
  {
    id: 'fokus-themen',
    question: 'Was sind Fokus-Themen?',
    answer:
      'Mit dem Stern in der Lernübersicht markierst du Themen, auf die du dich gerade konzentrieren willst. Dort siehst du gesammelt, wie weit du bei genau diesen Themen bist, und mit „Fokus-Lernen starten“ übst du alle offenen Fragen dieser Themen, die älteste richtige Antwort zuerst.',
  },
  {
    id: 'kartenaufgaben',
    question: 'Was sind die Kartenaufgaben?',
    answer:
      'Die Kartenaufgabe ist der zweite Teil der schriftlichen SKS-Theorieprüfung im Fach Navigation: Du trägst Orte, Kurse und Peilungen in die Seekarte ein und rechnest mit Gezeiten und Strom. Unter [Kartenaufgaben](/charts) übst du mit den amtlichen Aufgabenbögen der WSV: Aufgabe für Aufgabe schreibst du deine Antwort auf, siehst die amtliche Lösung samt Herleitung und vergibst dir selbst Punkte. Der Lotsen-Check rechnet auf Wunsch deine Werte nach und sucht deinen Fehler. Zu jedem Bogen verlinken wir außerdem eine Video-Anleitung auf YouTube.',
  },
  {
    id: 'pruefungssimulation',
    question: 'Was ist die Probeprüfung?',
    answer:
      'Ein zufälliger Fragebogen mit 30 Fragen und 90 Minuten Zeit, ohne Hilfen. Die Fragen sind wie von den Prüfungsausschüssen veröffentlicht auf die Fächer aufgeteilt (Navigation 9, Schifffahrtsrecht 7, Wetterkunde 5, Seemannschaft 9). Danach bewertest du dich Frage für Frage. Nach der Auswertung zählt deine Selbsteinschätzung für den Lernstand wie beim Üben, auch „Teilweise richtig“ und „Falsch“; eine schwache Probeprüfung kann ihn also senken. Mit einem Häkchen vor dem Start machst du daraus eine reine Probe, die deinen Lernstand nicht verändert; deine Wahl wird für die nächste Probeprüfung gemerkt. Die Kartenaufgabe ist nicht Teil der Probeprüfung; sie hat einen eigenen Bereich, siehe „Was sind die Kartenaufgaben?“.',
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
      'Nein, SKS Lotse deckt ausschließlich die SKS-Theorieprüfung ab: den amtlichen Fragenkatalog und die amtlichen Kartenaufgaben. Die praktische Ausbildung und Prüfung – zum Beispiel für Manöver auf einer Segelyacht – holst du dir bei einer Segelschule. Mehr dazu unter [So läuft die SKS-Prüfung ab](/exam-process).',
  },
]

// The short answers at the foot of /exam-process: shown on the page and, word for word, the
// page's FAQPage JSON-LD (publicPages.ts), so crawlers and answer engines can quote them.
export const EXAM_PROCESS_FAQ: { question: string; answer: string }[] = [
  {
    question: 'Wie läuft die SKS-Theorieprüfung ab?',
    answer:
      'Der Fragebogen hat 30 Fragen in 90 Minuten: 9 zur Navigation, 7 zum Schifffahrtsrecht, 5 zur Wetterkunde und 9 zur Seemannschaft. Dazu kommt eine separate Karten- und Gezeitenaufgabe, die in weiteren 90 Minuten bearbeitet und getrennt bewertet wird.',
  },
  {
    question: 'Was brauche ich, um zur SKS-Prüfung zugelassen zu werden?',
    answer:
      'Voraussetzung ist der Sportbootführerschein See (SBF See). Für die praktische SKS-Prüfung verlangt die Prüfungsordnung außerdem 300 Seemeilen Erfahrung auf Yachten in Küstengewässern.',
  },
  {
    question: 'In welcher Reihenfolge und Frist legt man Theorie und Praxis ab?',
    answer: 'Die Reihenfolge ist beliebig, beide Teile müssen aber innerhalb von 24 Monaten abgeschlossen sein.',
  },
  {
    question: 'Wie lange dauert die praktische SKS-Prüfung?',
    answer:
      'Höchstens 30 Minuten pro Prüfling, auf einer Segelyacht in Küstengewässern, mit Manövern, Navigation und Seemannschaft.',
  },
  {
    question: 'Brauche ich den SKS als privater Skipper?',
    answer:
      'Gesetzlich vorgeschrieben ist er nur für die gewerbliche Nutzung von Sportbooten in Küstengewässern. Privat wird er trotzdem oft verlangt, denn viele Vercharterer fordern den SKS als Befähigungsnachweis.',
  },
  {
    question: 'Was heißt gewerbliche Nutzung beim SKS?',
    answer:
      'Gewerblich fährst du, wenn du deine Dienste als Skipper öffentlich und regelmäßig gegen Bezahlung anbietest und dabei in Küstengewässern unterwegs bist, also bis 12 Seemeilen vor der Festlandküste. Typisch ist das, wenn du als Charterskipper gebucht wirst und eine fremde Crew fährst, wenn du als Skipper für einen Veranstalter fährst oder wenn du gegen Geld ausbildest. Auch Überführungen gegen Bezahlung gehören dazu, wenn du sie regelmäßig anbietest. Segelst du mit Freunden oder Familie und bekommst dafür nichts, ist das privat.',
  },
]

// The short answers at the foot of /learning-method: shown on the page and, word for word, the
// page's FAQPage JSON-LD (publicPages.ts). No numbers of the half-life model, on purpose
// (ADR-0024: the rule isn't readable at a glance, ADR-0034 has the values).
export const LEARNING_METHOD_FAQ: { question: string; answer: string }[] = [
  {
    question: 'Wie lerne ich den SKS-Fragenkatalog am besten?',
    answer:
      'Frage lesen, die Antwort selbst formulieren, mit der amtlichen Antwort vergleichen, ehrlich bewerten – und das über mehrere Tage verteilt wiederholen. SKS Lotse merkt sich für jede Frage, wie sicher du sie kannst, und holt sie zurück, bevor du sie vergisst.',
  },
  {
    question: 'Ist SKS Lotse eine digitale Lernkartei?',
    answer:
      'Im Prinzip ja, nur ohne Fächer und Zettel: Für jede Frage schätzt SKS Lotse, wie lange du sie voraussichtlich noch weißt, und passt das nach jeder Bewertung an. Was du sicher kannst, gilt als gelernt; was verblasst, kommt in der Übung zurück.',
  },
  {
    question: 'Was bedeutet Halbwertszeit beim Lernen?',
    answer:
      'Die Zeit, nach der man von einer Antwort nur noch etwa die Hälfte weiß. Sie wird mit jeder richtigen Antwort länger, vor allem wenn zwischen den Wiederholungen Zeit vergangen ist, und mit einer falschen oder teilweise richtigen Antwort kürzer.',
  },
  {
    question: 'Wie oft sollte ich Fragen wiederholen?',
    answer:
      'Regelmäßig und verteilt: besser an mehreren Tagen der Woche kurz als an einem Tag lange. Einen festen Rhythmus brauchst du nicht – im Modus „Auffrischen“ holt SKS Lotse Fragen zurück, die verblasst sind oder bald verblassen.',
  },
]

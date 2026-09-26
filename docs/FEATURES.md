# SKS Lotse: Funktionsübersicht

Was SKS Lotse heute kann, in der Sprache der Anwender. Für Produktmanager, Vertrieb und Segellehrer. Technik und Begründungen stehen in [ARCHITECTURE.md](ARCHITECTURE.md) und den [ADRs](adr/README.md).

## Auf einen Blick

SKS Lotse ist eine Web-Anwendung zur Vorbereitung auf die **theoretische Prüfung zum Sportküstenschifferschein (SKS)**. Sie läuft im Browser auf Handy, Tablet und Rechner, ohne App-Store.

Der amtliche Fragenkatalog des Bundes (ELWIS) besteht aus Freitextfragen, nicht aus Multiple Choice. Die Lernenden schreiben ihre Antwort selbst, vergleichen sie mit der amtlichen Musterantwort und bewerten sich selbst. Der Fragenkatalog wird unverändert übernommen, ELWIS ist als Quelle genannt.

Was SKS Lotse von reinem Durchblättern unterscheidet:
- Es merkt sich, was jemand **wirklich behalten** hat, und bringt Vergessenes zurück.
- Es bietet eine **Prüfungssimulation** unter Zeitdruck.
- Optional gibt ein **KI-Check (Lotsen-Check)** eine Einschätzung der eigenen Antwort.

## Zugang und Konto

- **Anmeldung nur mit E-Mail-Adresse und Einmalcode.** Es gibt kein Passwort. Ohne Anmeldung gibt es keinen Lernfortschritt, dafür ist er auf jedem Gerät derselbe.
- **Prüfungsvariante** pro Konto: „Segeln und Motor“ oder „Motor“. Die Fragen werden danach gefiltert.
- **Profil:** Name und Anrede (freiwillig), Prüfungsvariante, Lernstand, Prüfungsstatistik, E-Mail-Adresse ändern (per Code an die neue Adresse), Konto selbst löschen.
- Die Nutzungsbedingungen (AGB) werden einmal pro Version bestätigt.

## Lernen

Der Lernbereich bietet drei Modi, als Reiter nebeneinander, mit dem Gesamtfortschritt darüber.

**Ablauf einer Frage:** Frage lesen, Antwort auf dem Notizfeld formulieren (bleibt beim Lernenden, wird nirgends hin geschickt, solange er den KI-Check nicht auslöst), Musterantwort aufdecken, sich selbst bewerten: *Richtig*, *Teilweise richtig* oder *Falsch*. Fragen mit Abbildungen zeigen das Bild. Chart-Notation (etwa bei Navigationsfragen) wird lesbar dargestellt.

| Modus | Wofür | Wie |
|---|---|---|
| **Nach Thema** | Systematisch lernen | Die Fragen sind nach den Themen des amtlichen Katalogs sortiert (Navigation, Schifffahrtsrecht, Wetterkunde, Seemannschaft). Pro Thema ist der Stand sichtbar. |
| **Fokus** | Schwerpunkte setzen | Themen lassen sich mit einem Stern markieren. Die Fokus-Runde geht alle noch nicht gelernten Fragen dieser Themen durch, die am längsten zurückliegenden zuerst. Ist ein Thema komplett gelernt, fällt es aus dem Fokus. |
| **Auffrischen** | Vergessenes zurückholen | 20 Zufallsfragen, die schon einmal sicher gelernt waren. Mindestens 70 % davon sind bereits „verblasst“, der Rest verblasst in den nächsten zwei Tagen. |

**Wann gilt eine Frage als „gelernt“?** Nicht nach einmal richtig. Das System schätzt für jede Frage, wie lange die Antwort im Gedächtnis bleibt, und passt das bei jeder Bewertung an. Gelernt ist eine Frage, solange die Erinnerung voraussichtlich noch trägt. Lässt sie nach, taucht die Frage wieder auf. Wer wiederholt und mit Abstand richtig antwortet, kommt schneller voran. Die zugrunde liegenden Zahlen zeigt die Oberfläche bewusst nicht; die Lernenden sehen nur den Fortschritt.

## Prüfungssimulation

Ein Probelauf des **Fragebogens** der theoretischen Prüfung:
- 30 zufällige Fragen aus der gewählten Prüfungsvariante, verteilt auf die Fächer wie in der Prüfung (9 Navigation, 7 Schifffahrtsrecht, 5 Wetterkunde, 9 Seemannschaft).
- 90 Minuten, mit Countdown. Die Zeit wird vom Server überwacht, ein Neuladen oder eine falsche Geräteuhr helfen nicht. Antworten werden laufend gespeichert.
- Keine Tipps. Die Musterantworten sind erst nach der Abgabe zu sehen.
- Danach bewertet sich der Lernende Frage für Frage selbst (Richtig 2 Punkte, Teilweise 1, Falsch 0) und erhält ein Ergebnis.
- Verlauf und Statistik im Profil: Anzahl Versuche, Bestehensquote, Durchschnitt, Bestleistung, letzte Versuche, Anteil pro Fach.
- Richtig beantwortete Fragen zählen in den Lernstand ein.
- Nicht enthalten: die **Kartenaufgabe** (Navigation auf der Übungskarte).

Für Segellehrer: Die Simulation eignet sich als Abschlusstest zum Selbstlernen vor dem Prüfungstermin. Es gibt derzeit keine Gruppen- oder Lehrerfunktion (siehe unten).

## Lotsen-Check (KI-Einschätzung)

Der Lernende kann seine eigene Antwort vom „Lotsen“ prüfen lassen. Eine KI (Claude von Anthropic) vergleicht sie mit der Musterantwort und **schlägt eine Bewertung mit kurzer Begründung vor**. Die Entscheidung trifft immer der Lernende selbst.

- Kostet **1 Token** pro Prüfung. Neue Konten erhalten Startguthaben; weitere Tokens gibt es in Paketen.
- Übertragen werden nur Frage, Musterantwort und die Antwort des Lernenden (höchstens 1.000 Zeichen), nichts Persönliches. Die Verarbeitung erfolgt bei Anthropic in den USA, mit Auftragsverarbeitungsvertrag.
- Schutz gegen Missbrauch: höchstens 2 Prüfungen pro Frage und Tag, Begrenzung pro Stunde, Schutz vor eingeschleusten Anweisungen. Schlägt eine Prüfung technisch fehl, wird das Token zurückgebucht.
- Bei einem Ausfall der KI lernt man normal weiter, nur der Check fehlt.

## Kaufen und Preise

Zwei unabhängige Bausteine, in allen Kombinationen möglich:
- **Tokens für den Lotsen-Check** in vier Paketen (Startpreise: S 20 Tokens 2,99 €, M 50 Tokens 5,99 €, L 100 Tokens 9,99 €, XL 200 Tokens 16,99 €), Startguthaben 6 Tokens gratis. Bezahlung über Stripe (Kreditkarte und weitere Zahlarten), nach dem Kauf kommt eine Bestätigungs-Mail. Die Preise sind vom Betreiber änderbar und stehen öffentlich auf der Preisseite.
- **Werbefrei** (Einmalzahlung, Startpreis 5 €). Ohne dieses Paket sind später Anzeigen vorgesehen.

Stand heute: Der Token-Kauf ist eingebaut, aber noch nicht für alle Lernenden freigeschaltet; der Betreiber kann ihn schrittweise öffnen (aus, nur Administratoren, alle). Werbefrei wird noch von Hand gutgeschrieben, Werbeanzeigen werden noch nicht ausgespielt.

## Rückmeldung und Qualität

- **Frage melden:** unter jeder Frage kann ein Fehler gemeldet werden (Fragetext, Antworttext, Tippfehler, fehlendes Bild, Sonstiges). Der Betreiber sieht die am häufigsten gemeldeten Fragen im Tagesbericht.
- **Feedback** per E-Mail-Link im Menü, „Kontakt“ in der Fußzeile.

## Öffentliche Seiten

Startseite mit Funktionsüberblick, Preise, FAQ, „Ablauf der Prüfung“, Impressum, Datenschutz, AGB. Sie sind für Suchmaschinen aufbereitet.

## Datenschutz

- Zugang nur mit E-Mail-Adresse, kein Passwort, keine Weitergabe an Werbenetzwerke ohne Einwilligung; Werbe-Einwilligung über die Cookie-Einstellungen in der Fußzeile.
- Hosting in Frankfurt (EU). Auswertung der Seitennutzung ohne Cookies.
- Konto und alle Lerndaten lassen sich jederzeit selbst löschen. Auskunft und Datenexport erfolgen auf Anfrage über den Betreiber.

## Betreiberwerkzeuge (nicht für Lernende)

Geschützt durch Freigabeliste und Zwei-Faktor-Code (Authenticator-App):
- Konten suchen, ansehen, exportieren, löschen, sperren, Tokens oder Werbefrei gutschreiben.
- Sperrliste für E-Mail-Adressen und Domains gegen Missbrauch.
- Preise und Pakete einstellen.
- Fragen und Musterantworten im gesamten Katalog durchsuchen.
- Täglicher Kennzahlen-Bericht per E-Mail; Wartungsmodus, wenn etwas schiefgeht.

## Noch nicht verfügbar

- Tipps zu einzelnen Fragen
- Anmeldung über Google, Facebook oder X
- Bezahlung von „Werbefrei“ in der Anwendung, ausgespielte Werbung
- Automatische Bewertung einer ganzen Prüfung in einem Schritt
- Spracheingabe für Antworten
- Kartenaufgabe in der Prüfungssimulation
- Lehrer- oder Gruppenfunktionen für Segelschulen (Kurse, Einblick in den Fortschritt der Schüler)
- Automatisches Löschen von Konten nach 12 Monaten ohne Anmeldung (die AGB behalten sich das vor)

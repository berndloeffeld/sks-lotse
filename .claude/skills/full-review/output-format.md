# Ergebnisformat des vollen Reviews

Gehört zum Skill [full-review](SKILL.md), Phase 3. Ergebnis liegt in `RUN` = `<ROOT>/.claude/reviews/<YYYY-MM-DD>/` (gitignored):

```
report.md                  Überblick für den Nutzer
prompts/01-<slug>.md …     je Arbeitspaket ein einfügbarer Prompt
```

Sprache: Deutsch (Bezeichner, Pfade und Befehle wie im Code). Pfade immer relativ zum Repo-Root, Zeilen als `datei:zeile`.

## Arbeitspakete bilden

- **4–8 Pakete**, nicht mehr. Wirkt das Ergebnis kleinteilig, bündeln, statt Prompts zu vermehren.
- **Ein Paket = eine Session = ein PR** (ausnahmsweise zwei aufeinanderfolgende). Als Obergrenze gilt, was ein Mensch in einem Rutsch reviewen kann.
- **Schnitt nach berührtem Code- oder Themenbereich**, nicht strikt nach Lens: Befunde, die dieselben Dateien oder dieselbe Doku ändern, gehören zusammen (z. B. ein Security-Befund und sein Doku-Nachzug), auch lensübergreifend.
- **Nicht mischen**: `critical`/`high`-Security-Befunde stehen nie im selben Paket wie Kosmetik oder Umbauten.
- **Quick wins**: alles Kleine und Unabhängige (Aufwand S, Schwere low/medium) in ein einziges Paket „Quick wins“, nicht einzeln.
- **Reihenfolge** der Nummern: zuerst Schwere, dann kleiner Aufwand; Abhängigkeiten zwischen Paketen ausdrücklich nennen („erst 02, dann 05“). Pakete ohne Abhängigkeit müssen parallel in getrennten Sessions laufen können, ohne dieselben Dateien anzufassen.
- **Entscheidungsfälle** (Befund hängt an einer Geschmacks-, Geschäfts- oder Rechtsfrage des Betreibers) kommen nicht in einen Prompt, sondern in die Entscheidungsliste des Berichts, jeweils mit Optionen und Empfehlung. Hängt ein Paket an einer solchen Entscheidung, steht im Prompt, dass die Session sie zuerst per `AskUserQuestion` einholt.
- **Kein Paket ohne Belegzeilen.** Jeder aufgenommene Befund behält seine ID und seine Stelle (`datei:zeile`).
- Befunde, die nach der Gegenprüfung nicht halten oder nicht lohnen, kommen nicht in einen Prompt, sondern unter „Verworfen“ im Bericht.

## Prompt-Datei

Reiner Text, der unverändert in eine neue Session in diesem Repo eingefügt wird (`CLAUDE.md` wird dort automatisch geladen, also nicht wiederholen, nur die Regeln nennen, die hier konkret greifen). Keine Meta-Kommentare über den Review. Aufbau, nur diese Überschriften:

```markdown
# <Titel des Pakets>

**Ziel:** <ein bis zwei Sätze: was ist danach besser>

## Hintergrund
<Warum das Paket existiert, in wenigen Sätzen. Befunde stehen auf Main-Stand `<sha7>` vom <Datum>
(Review auf origin/main); main kann sich bewegt haben – jeden Befund vor der Umsetzung kurz am
aktuellen Code bestätigen und Erledigtes überspringen.>

## Befunde
### <ID> · <Titel> (<Schwere>, Aufwand <S|M|L>)
- Stelle: `datei:zeile` [, weitere]
- Problem: <konkret, mit Wirkung>
- Gewünscht: <Änderung in Worten, kein fertiger Patch>
…

## Vorgehen
1. Zuerst einen Plan vorlegen (Plan Mode), erst nach meiner Freigabe umsetzen.
2. <Reihenfolge innerhalb des Pakets, Abhängigkeiten, Entscheidungsfragen per AskUserQuestion>

## Randbedingungen (aus CLAUDE.md, hier konkret)
- Eigener `feature/*`-Branch von `main`, Änderung per PR; nicht auf `main` committen.
- <nur das, was zutrifft: Doku im selben PR (welche Dateien); Postman/`schema.gen.ts` neu erzeugen;
  ADR nötig (Anlass); Ratchet nicht senken; Mutation-Scope anpassen; Migration abwärtskompatibel;
  Katalogtexte unverändert; keine Zahlen der Halbwertszeit in der UI …>
- Lange Tests (volle Coverage, Mutation, Integration) erst nach Rückfrage bei mir.

## Abgrenzung
<Was in diesem Paket ausdrücklich nicht angefasst wird (gehört zu Paket NN oder ist entschieden).>

## Fertig, wenn
- <prüfbare Kriterien je Befund>
- <schnelle Prüfbefehle, z. B. gezielte Tests, `ruff check`, `npm run lint`, `tsc -b`>

**Empfehlung:** Modell <…>, Effort <…> (<kurze Begründung, z. B. Security-Paket → Opus/xhigh,
reiner Doku-Nachzug → Sonnet/high>).
```

Anforderungen an den Inhalt:
- Der Prompt muss **für sich allein** funktionieren: die neue Session kennt weder diesen Review noch die Rohbefunde.
- Befunde wörtlich genug, dass die Session die Stelle sofort findet und das Problem versteht, aber **keine fertigen Patches** und kein Fließtext-Essay.
- Randbedingungen nur, wenn sie das Paket tatsächlich betreffen; keine Wiederholung der gesamten `CLAUDE.md`.
- Länge: so kurz wie möglich, in der Regel unter einer Bildschirmseite pro 5 Befunde.

## report.md

```markdown
# Voller Review – <YYYY-MM-DD>

- Stand: `origin/main` @ `<sha7>` (<Commit-Datum>)
- Modell/Effort: <…> (<„wie gefordert“ | „Abweichung bestätigt“>)
- Lenses: <gelaufene>; nicht abgeschlossen: <… oder „keine“>
- Verbrauch: 5-h-Fenster <vorher>→<nachher> %, Woche <vorher>→<nachher> % (Schätzung war <…>)

## Überblick
<drei bis fünf Sätze: was ist der Gesamteindruck, wo liegt das meiste Gewicht>

| Lens | critical | high | medium | low |
|---|---|---|---|---|
| … | | | | |

## Arbeitspakete
| Nr | Paket | höchste Schwere | Aufwand | Befunde | Reihenfolge/Abhängigkeit | Datei |
|---|---|---|---|---|---|---|
(Link auf die Prompt-Datei; Empfehlung, womit zu beginnen ist und was man sich sparen kann)

## Entscheidungen für dich
<je Frage: Hintergrund, Optionen, Empfehlung, betroffenes Paket>

## Verworfen oder abgestuft
<ID, Titel, Grund (z. B. „durch ADR-00NN entschieden“, „Gegenprüfung: Stelle existiert nicht mehr“)>

## Geprüft ohne Befund
<je Lens Stichworte aus den Befunddateien>

## Nicht geprüft / Grenzen
<Lücken, 403 bei `gh api`, nicht erreichbare Seiten, kein Live-Pass, nicht abgeschlossene Agenten>
```

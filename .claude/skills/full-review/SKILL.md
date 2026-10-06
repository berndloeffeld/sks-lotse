---
name: full-review
description: Voller Review von origin/main auf Security, Projekt-/Entwicklungsmodell und Quality Gates, Code-Reduktion, UX/UI-Konsistenz und Doku. Liefert als Ergebnis Prompt-Dateien für neue Sessions, ändert nichts am Code. Teuer – nur auf ausdrücklichen Wunsch ("voller Review", "/full-review").
disable-model-invocation: true
argument-hint: "[security,process,code,ux,docs – kommagetrennt, Standard: alle]"
---

# Voller Review von origin/main

Sucht auf dem aktuellen `origin/main` nach Problemen und Verbesserungspotenzial und verdichtet das Ergebnis zu **4–8 Arbeitspaketen als fertige Prompts**, je einer pro neuer Session. Der Review selbst ändert nichts am Projekt: kein Commit, kein Push, keine Edits außerhalb von `.claude/reviews/` und dem Scratchpad. **Der Aufruf dieses Skills ist die ausdrückliche Anweisung, Subagenten zu starten.**

Argumente: `$ARGUMENTS` (leer = alle Lenses). Lenses: `security`, `process` (Entwicklungsmodell + Quality Gates), `code` (Reduktion/Optimierung, läuft als zwei Agenten `code-backend` und `code-frontend`), `ux`, `docs`.

## Konfiguration (hier anpassen)

| Wert | Stand |
|---|---|
| Akzeptierte Modelle (`model` aus `get_session`) | `claude-opus-5-5` |
| Akzeptierter Effort | `xhigh`, `max` |
| Projektion darf im 5-h-Fenster und in der Woche (auch pro Modell) höchstens | 90 % |
| Geschätzter Verbrauch je Agent: 5-h-Fenster / Woche | 12 % / 4 % (Startwerte, nicht gemessen; nach dem ersten Lauf aus dem Bericht kalibrieren) |
| Aufschlag Synthese: 5-h-Fenster / Woche | 8 % / 2 % |
| Kontextfüllstand dieser Session höchstens | 20 % |
| Kanonischer Projektpfad (`ROOT`) | `/Users/berndloffeld/Projects/sks-lotse` |

`ROOT` gilt auch dann, wenn die Session in einem Worktree läuft: Skill-Dateien und Ergebnisse liegen dort. `WORK` = `<Scratchpad aus dem System-Prompt>/full-review/` (anlegen). `RUN` = `ROOT/.claude/reviews/<YYYY-MM-DD>/` (existiert der Tag schon, `-2` anhängen; gitignored).

## Phase 0 – Preflight (nichts ändern, bevor er bestanden ist)

1. **Modell und Effort.** `mcp__ccd_session_mgmt__get_session` mit `session_id: "self"` (und `get_usage`) bei Bedarf per ToolSearch laden: `select:mcp__ccd_session_mgmt__get_session,mcp__ccd_session_mgmt__get_usage`. Stehen sie nicht zur Verfügung (reines CLI): Modell aus dem System-Prompt nehmen, Effort und Verbrauch per `AskUserQuestion` erfragen.
   Weicht Modell oder Effort von der Konfiguration ab: **stoppen** und per `AskUserQuestion` fragen – „Ich stelle um (Modellmenü) und starte neu“ / „Trotzdem mit <Modell>/<Effort> weiter“. Die eigene Session lässt sich nicht umschalten (`set_session_model`/`set_session_effort` sind dafür gesperrt), also nicht versuchen. Bei „weiter“ die Abweichung im Berichtskopf vermerken.
2. **Budget.** `get_usage` lesen. Agentenzahl = Lenses, `code` zählt doppelt. Projektion = `genutzt + Agenten × Schätzwert + Synthese-Aufschlag`, je Fenster. Ohne Extra-Usage (`extraUsage.enabled: false`) endet ein überschrittenes Limit hart mitten im Lauf – deshalb vorher rechnen.
   Liegt eine Projektion über der Grenze, oder setzt das 5-h-Fenster in weniger als 20 Minuten zurück: genutzte %, Projektion und Reset-Zeit zeigen und per `AskUserQuestion` fragen – „Weniger Lenses“ (konkreten Vorschlag nennen) / „Trotzdem“ / „Später“.
   Liegt der Kontextfüllstand der Session über der Grenze: neue Session empfehlen (die Synthese braucht Platz).
3. **Ausgangswerte merken** (5-h-%, Wochen-%, Modell, Effort) für den Berichtskopf.
4. Läuft `ux`: einmal fragen, ob zusätzlich die **öffentlichen Seiten live** in der Browser-Pane angesehen werden sollen (Default nein; Login-Seiten sind so nicht erreichbar).

## Phase 1 – Snapshot und Kontext

```bash
git -C "$ROOT" fetch origin main
git -C "$ROOT" worktree add --detach "$WORK/main-snapshot" origin/main
ln -s "$ROOT/frontend/node_modules" "$WORK/main-snapshot/frontend/node_modules"   # eslint/tsc im Snapshot
```

Der Snapshot ist die einzige Quelle des Reviews (nicht der gerade ausgecheckte Branch). Linter laufen mit `ROOT/backend/.venv/bin/ruff check --no-fix …` gegen den Snapshot; nichts installieren.

`WORK/context.md` schreiben (knapp, alle Agenten lesen sie):
- Main-SHA und Commit-Datum, Datum des Reviews.
- Offene PRs und Issues (`gh pr list`, `gh issue list`, nur Nummer + Titel): Befunde, die dort schon gelöst werden, nicht neu melden.
- Inhalt von `ROOT/TODO.md` (gitignored, privat: **nur lesen, nie ändern**) als „bereits bekannt“.
- Offene Punkte des letzten `ROOT/.claude/reviews/*/report.md`; per `git log` auf Main prüfen, was inzwischen erledigt ist.

## Phase 2 – Lenses parallel

Alle Agenten in **einer** Nachricht starten (`subagent_type: general-purpose`, **kein** `model`-Parameter: sie erben das Session-Modell). Jeder Prompt, mit eingesetzten Werten:

> Du bist Review-Agent für die Lens `<lens>` im vollen Review von SKS Lotse. Snapshot von origin/main @ `<sha>` (nur lesen): `<WORK>/main-snapshot`. Lies zuerst `<ROOT>/.claude/skills/full-review/lenses.md` (Abschnitte „Gemeinsamer Kopf“, „Befundformat“ und „<lens>“), dann `CLAUDE.md` und `docs/adr/README.md` im Snapshot und `<WORK>/context.md`. Dein Scope: `<scope>`. Schreibe die Befunde nach `<WORK>/findings-<lens>.md` und ändere sonst nichts. Antworte am Ende mit höchstens 15 Zeilen: Zahl der Befunde je Schwere, die drei wichtigsten Titel, was du nicht schaffen konntest.

Scopes: `security` ganzes Repo · `process` `.github/`, `scripts/`, `.pre-commit-config.yaml`, `render.yaml`, `.claude/`, Konfigdateien (`pyproject.toml`, `vite.config.ts`, `package.json`, Stryker), `docs/NON-FUNCTIONAL-REQUIREMENTS.md`, `docs/mutation-testing.md` · `code-backend` `backend/` · `code-frontend` `frontend/` · `ux` `frontend/src` (pages, components, `index.css`, Texte) · `docs` alle `*.md`, `docs/`, Code-Kommentare, juristische Seiten im Frontend.

Harte Grenzen für alle Agenten (im Prompt wiederholen): keine Test-, Coverage- oder Mutationsläufe (der Hook `ask-before-long-tests.sh` verlangt dafür ohnehin eine Rückfrage); nichts installieren oder herunterladen; `gh` nur lesend (GET), nie `-X POST/PATCH/PUT/DELETE`; keine Anfragen an Produktivsysteme; `TODO.md` nicht ändern; nichts außerhalb von `WORK` schreiben.

Ein Agent, der ausfällt oder keine Datei liefert: einmal mit engerem Scope wiederholen, sonst im Bericht als „nicht abgeschlossen“ führen. **Befunde nie erfinden oder aus dem Gedächtnis ergänzen.**

Während die Agenten laufen (nur wenn in Phase 0 gewünscht): Live-Pass der öffentlichen Seiten in der Browser-Pane. Routen aus `frontend/src/publicPages.ts` des Snapshots, Domain `sks-lotse.de`; mobil (`resize_window` preset `mobile`) und Desktop, höchstens ~8 Screenshots mit `scale: 0.5`, Text bevorzugt per `get_page_text`/`read_page`. Wird eine Seite verweigert: überspringen. Ergebnisse als `WORK/findings-ux-live.md` im Befundformat (IDs `U-L01 …`); danach Viewport auf `desktop` zurücksetzen.

## Phase 3 – Synthese

Format und Regeln: [output-format.md](output-format.md). Reihenfolge:

1. Budget erneut mit `get_usage` prüfen; bei knapper Lage zuerst `report.md` mit den Rohbefunden sichern, Prompts danach.
2. Alle `WORK/findings-*.md` lesen.
3. **Gegenprüfen**: alle `critical`/`high`-Befunde und alle mit Konfidenz `low` an den zitierten Stellen im Snapshot nachlesen. Hält ein Befund nicht, verwerfen oder abstufen und unter „Verworfen“ mit Grund notieren.
4. Doppelte und gleichartige Befunde lensübergreifend zusammenführen (DSGVO: `security` besitzt „wird korrekt behandelt“, `docs` besitzt „Text stimmt“).
5. In 4–8 Arbeitspakete clustern, Entscheidungsfälle getrennt führen (Regeln in `output-format.md`).
6. Pro Paket `RUN/prompts/NN-<slug>.md` schreiben, dann `RUN/report.md`.

## Phase 4 – Abschluss

```bash
git -C "$ROOT" worktree remove --force "$WORK/main-snapshot" && git -C "$ROOT" worktree prune
git -C "$ROOT" status --short        # unverändert zum Start (nur .claude/reviews/ ist neu und ignoriert)
```

`get_usage` erneut lesen, das Verbrauchsdelta in den Berichtskopf eintragen. Weicht es um mehr als das 1,5-Fache von den Schätzwerten ab, im Chat kalibrierte Werte vorschlagen (die Konfiguration oben nur nach Zustimmung ändern).

Antwort im Chat: Kurzfassung (Zahl der Befunde je Lens und Schwere), Tabelle der Prompts mit Link auf jede Datei, Entscheidungsliste, empfohlene Reihenfolge. Die Prompt-Texte stehen nur in den Dateien. Nichts committen.

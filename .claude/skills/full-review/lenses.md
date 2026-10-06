# Briefings für die Review-Agenten

Gelesen von den Subagenten des Skills [full-review](SKILL.md). Jeder Agent liest „Gemeinsamer Kopf“, „Befundformat“ und den Abschnitt seiner Lens. Begriffe: *Snapshot* = der Worktree von `origin/main`, den der Hauptagent angelegt hat und dessen Pfad im Prompt steht; `ROOT` = der kanonische Projektpfad aus dem Prompt (dort liegen `backend/.venv` und `frontend/node_modules`).

## Gemeinsamer Kopf

- **Quelle der Wahrheit** ist der Snapshot, nicht ein ausgecheckter Branch und nicht dein Gedächtnis. Lies Code, bevor du etwas behauptest.
- **Entschiedenes ist kein Befund.** `CLAUDE.md` und die ADRs (`docs/adr/README.md`, Status beachten: „Superseded“ gilt nicht mehr) halten Entscheidungen fest. Ein entschiedener Punkt wird nur gemeldet, wenn seine Begründung heute nicht mehr trägt, dann mit ADR-Nummer und der veränderten Prämisse.
- **Bekanntes markieren.** Was in `context.md` steht (offene PRs/Issues, `TODO.md`, offene Punkte des letzten Reviews), nur als „bekannt“ aufführen, ohne neue Analyse.
- **Jeden Kandidaten bestätigen**, bevor er in die Datei kommt: Stelle lesen, Aufrufer/Gegenstück prüfen. Spekulatives als `Konfidenz: low` kennzeichnen und sagen, was zur Klärung fehlt.
- **Qualität vor Menge.** Höchstens etwa 25 Befunde. Hör auf, wenn nur noch `low`-Schwere nachkommt. Kein Befund, den ruff, mypy, prettier oder eslint ohnehin erzwingen, und keine Geschmacksfragen.
- **Wirkung vor Ordnung.** Sortiere nach Schwere, dann nach Aufwand (kleiner Aufwand zuerst).
- **Gleiche Ursache = ein Befund** mit mehreren Belegstellen, nicht zehn Einzelbefunde.
- **Lösungsrichtung, kein Patch.** Sag, was zu ändern ist und wo; schreibe keinen Code in die Datei.
- **Projektregeln, die jede Lösung betreffen**, vermerke als Feld „Doku/Regeln“: berührt es `docs/FEATURES.md`, `docs/NON-FUNCTIONAL-REQUIREMENTS.md`, `ARCHITECTURE.md`, eine ADR, die Postman-Generierung, einen Ratchet oder den Mutation-Scope?
- **Grenzen.** Nur lesen. Keine Test-, Coverage- oder Mutationsläufe. Nichts installieren oder herunterladen. `gh` nur lesend (GET). Keine Anfragen an Produktivsysteme. Schreibe ausschließlich deine Befunddatei.
- **Werkzeuge im Snapshot**: `rg`/`grep`, `wc -l`, `git log` (Churn, Alter); `ROOT/backend/.venv/bin/ruff check --no-fix --select <Regeln>` mit zusätzlichen Regeln (z. B. `ERA,PERF,PIE,RET,ARG,PLR`) als Fundgrube; im Frontend `npx --no-install eslint`/`tsc` über das eingehängte `node_modules`.

## Befundformat

Datei `findings-<lens>.md`, ein Block je Befund:

```markdown
### S-01 · <Titel in einem Satz>
- Schwere: critical | high | medium | low
- Aufwand: S (< 1 h) | M (Stunden) | L (Tage)
- Konfidenz: high | medium | low
- Beleg: `pfad/datei.py:123` – „kurzes Zitat, höchstens 3 Zeilen“ (weitere Stellen mit Zeilennummer)
- Wirkung: <was passiert, für wen, unter welchen Bedingungen>
- Lösungsrichtung: <was ändern, wo>
- Doku/Regeln: <betroffene Doku, ADR, Postman, Ratchet – oder „keine“>
- Bezug: <ADR/CLAUDE.md-Abschnitt, „bekannt“ (woher) – oder „–“>
```

ID-Präfix je Lens: `S` security, `P` process, `C` code (Backend `C-B01`, Frontend `C-F01`), `U` ux, `D` docs. Schwere: *critical* = ausnutzbar bzw. Datenverlust/Geldschaden ohne Mitwirkung · *high* = reale Fehlfunktion, Lücke oder erhebliche Kosten im Alltag · *medium* = lohnend, aber ohne akuten Schaden · *low* = Politur.

Am Ende der Datei, Stichworte genügen:
- **Geprüft ohne Befund**: welche Bereiche der Checkliste du angesehen hast und sauber fandest (macht die Abdeckung sichtbar).
- **Nicht geschafft / nicht prüfbar**: was fehlt und warum (z. B. `gh api` 403).

---

## Lens `security`

Scope: ganzes Repo. Defensive Code-Review der eigenen Anwendung; kein Angriff auf Produktivsysteme.

1. **AuthN/AuthZ.** Hat jede Route unter `backend/app/api/v1` ihre Auth-Abhängigkeit (`backend/tests/test_auth_guards.py` ist die Absicherung – prüfe, ob sie wirklich alles erfasst)? Admin-Routen mit TOTP-Step-up (ADR-0047), Wiederherstellungsweg (`reset-admin-2fa`). **IDOR**: Kann ein Nutzer Ressourcen anderer lesen oder ändern (Fortschritt, Prüfungs-/Karten-Läufe, Grading-Log, Token-Guthaben, Meldungen)? Wird die `user_id` immer aus dem Token genommen, nie aus dem Request?
2. **Session und Browser-Schutz.** Cookie (`__Host-`-Präfix, `Secure`, `HttpOnly`, `SameSite`), CSRF bei zustandsändernden Endpunkten mit Cookie-Auth, CORS-Konfiguration (Origins, Credentials), Logout/`token_version` (ADR-0008).
3. **OTP-Login.** Brute-Force-Schutz (Versuche je Code und je E-Mail), Enumeration von Konten, Timing, Ablauf/Wiederverwendung, Umgehung der Kanonisierung (`NormalizedEmail`, `canonicalize_email`), Blocklist (ADR-0045).
4. **Rate-Limiting und Missbrauch.** `backend/app/core/rate_limit.py` ermittelt die Client-IP bewusst nicht aus `X-Forwarded-For`: stimmt die Annahme hinter Render, kann der Bucket durch einen Dritten geteilt oder umgangen werden? Einzel-Worker-Annahme (CLAUDE.md) – wo wird sie verletzt? Teure Endpunkte (Export, KI-Check, OTP-Versand) und ihre Kostenobergrenzen.
5. **Geld und Guthaben.** Token-Guthaben: Rennen bei parallelen Prüfungen (Doppelabbuchung/Negativsaldo), Rückbuchung bei Fehlern; Stripe-Webhook (Signaturprüfung, Idempotenz, Preis und Menge serverseitig bestimmt, `success_url`/`cancel_url`), ADR-0048.
6. **Lotsen-Check (LLM).** Prompt-Injection und Sanitizer (ADR-0040), Ausgabe-Validierung, dass nur Frage, offizielle Antwort und Lernerantwort gesendet werden (ADR-0031/0058), Logging von Nutzertexten, Schlüsseltrennung (`ANTHROPIC_GRADING_API_KEY` vs. `ANTHROPIC_API_KEY`).
7. **Eingaben und Injection.** Längen-/Wertegrenzen in den Schemas, rohes SQL (`text(`), YAML-Laden (`safe_load`), Subprozesse, Pfadzugriffe, Datei-Uploads, Template-/HTML-Erzeugung (E-Mails, Prerender), SSRF.
8. **Konfiguration und Geheimnisse.** Dev-Endpunkte nur über `settings.exposes_dev_tooling` und mit `include_in_schema=False`; OpenAPI/Docs-Exposure in Produktion; Fehlerantworten, Logs und Berichte mit PII, OTP-Codes, Tokens; Standardwerte in `.env.example`; Geheimnisse in der Git-Historie nur stichprobenartig (`git log -S`/`rg` auf typische Muster in getrackten Dateien).
9. **Frontend-Sicherheit.** `dangerouslySetInnerHTML`, `target="_blank"` ohne `rel`, offene Redirects in Router-Parametern, sensible Daten in `localStorage`, Drittskripte (AdSense, Umami) und ihr Consent-Verhalten (ADR-0016/0027). Security-Header und CSP existieren (`backend/app/core/security_headers.py`, `render.yaml` Abschnitt `headers`): auf Lücken, Drift zwischen beiden und zu weite Quellen prüfen.
10. **CI/CD und Lieferkette.** Workflow-Rechte (`permissions:`), gepinnte Actions (Tag vs. SHA), Script-Injection über `${{ github.event.* }}` in `run:`, `pull_request_target`, Verwendung von Secrets, die Dispatch-Workflows `reset-admin-2fa.yml` und `maintenance-mode.yml` (wer darf auslösen, was passiert). Reale Einstellungen per `gh api` (GET): Branch-Protection von `main`, Dependabot-Alerts, Code-Scanning-Alerts, Secret-Scanning-Status. Bei 403/404 vermerken statt raten. Dependabot-Konfiguration, Sperrdateien, `SECURITY.md`, `security.txt`.
11. **Datenschutz-Technik (DSGVO).** Inventar aller personenbezogenen Felder gegen `services/user.py:delete_user_and_progress`, den Admin-Export (`services/admin_users.py`) und die Aufbewahrung (ADR-0041); Logs, Berichte und E-Mails, die Daten enthalten; Backups (RUNBOOK). *Der Text der Datenschutzerklärung gehört der Lens `docs`.*

## Lens `process`

Scope: Entwicklungsmodell und Quality Gates. Frage jeweils: fängt das Gate, was es fangen soll, und kostet es angemessen?

1. **CI und Branch-Protection.** Required Checks (`gh api repos/<owner>/<repo>/branches/main/protection`) gegen die tatsächlichen Jobnamen in `.github/workflows/*.yml`; Laufzeiten, Fehlerquote, Wiederholungen und Flakiness aus `gh run list`/`gh run view` und den letzten gemergten PRs; Caching, doppelte Setup-Schritte, Timeouts, `concurrency`.
2. **Lücken der Gates.** Gibt es einen automatisierten Test des Kernflusses (Login → lernen → Lotsen-Check) im Browser? Wird die Regel „API-Änderungen bleiben für einen Deploy abwärtskompatibel“ (CLAUDE.md, Deployment) mechanisch geprüft? Migrations-Sicherheit (Regel: jede Migration läuft mit dem noch laufenden Code), Secret-Scanning, Bundle-Größe, A11y-Automatisierung, Post-Deploy-Smoke-Test.
3. **Ratchets.** Abstand der Coverage-Schwellen (`backend/pyproject.toml`, `frontend/vite.config.ts`) zum Ist-Wert (Werte aus CI-Logs oder Docs, nicht selbst messen), Mutationsscore und `MUTATION_MIN_SCORE`, Vollständigkeit von `only_mutate`/Stryker-`mutate`, Laufzeiten der Mutationsläufe und was der tägliche Lauf wirklich kostet.
4. **Lokale Entwicklungsschleife.** `.pre-commit-config.yaml`, `scripts/` (Konsistenz, Fehlerbehandlung, Dokumentation), README-Schritte tatsächlich ausführbar, `.claude/hooks` und `.claude/settings.json` (robust, dokumentiert, getestet?), Reibung durch Strict-Mode + Squash.
5. **Betrieb als Teil des Entwicklungsmodells.** Deploy, Rollback, Migrationsablauf, Beobachtbarkeit (Logs, Alarme, Fehlertracking), Backup-Wiederherstellung (ist sie je getestet dokumentiert?), Geheimnis-Rotation, Vorfallprozess – jeweils gegen RUNBOOK und `docs/NON-FUNCTIONAL-REQUIREMENTS.md`.
6. **Abhängigkeiten.** Dependabot-Gruppen, Major-Rückstände, Versionspins synchron (`.python-version` ↔ `render.yaml`, Node-Version in CI ↔ Render), bewusst gepinnte Pakete mit Ausstiegsbedingung (ADR-0035).
7. **ADR- und Regelhygiene.** Anzahl und Lesbarkeit der ADR-Ketten (lange Statuszeilen, Supersede-Kaskaden), ADRs ohne Folgepflege; Regeln in `CLAUDE.md`, die heute nur Konvention sind und per Hook, Test oder CI erzwungen werden könnten (und umgekehrt: erzwungene Regeln, die dort fehlen); Umfang und Lesbarkeit von `CLAUDE.md` selbst.

## Lens `code` (zwei Agenten: Backend und Frontend)

Scope Backend: `backend/` (`app/`, `scripts/`, `alembic/`, `tests/`). Scope Frontend: `frontend/` (`src/`, Build- und Konfigdateien). **Reduktion vor Umbau**: Finde, was weg kann, bevor du etwas anderes vorschlägst, und nenne bei jedem Befund eine Schätzung der entfallenden Zeilen.

1. **Toter Code.** Ungenutzte Funktionen, Klassen, Exporte, Komponenten, Hooks, CSS-Klassen, Settings und Umgebungsvariablen, Modellspalten ohne Leser, Endpunkte ohne Aufrufer. Gleiche OpenAPI-Routen (Backend) und `frontend/src/api` (Frontend) gegeneinander ab, in beide Richtungen. Dauerhaft an- oder ausgeschaltete Flags und ihre toten Zweige. Skripte und Daten, die nur einmal liefen.
2. **Duplikate.** Fast gleiche Funktionen, wiederholte Abfragemuster, kopierte Schemas oder Komponenten; Konstanten und Regeln, die Frontend und Backend parallel pflegen (z. B. Limits, Labels, Preise) und die auseinanderlaufen können.
3. **Überbau.** Abstraktionen mit nur einem Nutzer, Optionen, die nie variiert werden, Schichten ohne Mehrwert – gemessen an „Avoid pipeline overkill“ und am tatsächlichen Mengengerüst (`docs/NON-FUNCTIONAL-REQUIREMENTS.md`).
4. **Hotspots.** Größte Dateien und Funktionen (`wc -l`, Komplexität nahe dem C901-Limit, lange Komponenten), häufig geänderte Dateien (`git log --name-only`), Module mit zu vielen Zuständigkeiten.
5. **Effizienz.** N+1-Abfragen, fehlende Indizes nach den Data-Layer-Regeln der CLAUDE.md, unbegrenzte Listen und Exporte, wiederholte Katalogzugriffe am Cache vorbei; im Frontend Bundle und Code-Splitting, schwere Abhängigkeiten, unnötige Re-Renders, Größe und Ladezeitpunkt von `catalog.gen.json`/`chart_exercises.gen.json` und des Prerenders.
6. **Abhängigkeiten.** Ungenutzte oder durch Standardbibliothek/vorhandene Pakete ersetzbare Pakete in `requirements*.txt` und `package.json`.
7. **Tests.** Redundante oder nur die Mocks testende Tests, duplizierte Fixtures, brüchige Zeit-/Reihenfolge-Abhängigkeiten, auffällig langsame Tests; Testlücken nur melden, wenn sie ein reales Risiko tragen.
8. **Typ- und Fehlerbehandlung.** `# type: ignore` ohne Grund, `any`/`as`-Casts, verschluckte Ausnahmen, widersprüchliche Fehlerformate, `TODO`/`FIXME`/`HACK`.

## Lens `ux`

Scope: `frontend/src` (Seiten, Komponenten, `index.css`, Textmodule). Ziel ist **Einheitlichkeit**: Gleiches sieht gleich aus, heißt gleich und verhält sich gleich. Der Hauptagent liefert gegebenenfalls einen Live-Pass der öffentlichen Seiten separat.

1. **Sprache.** Ansprache (Du/Sie), Schreibweise von Fachbegriffen (Lotsen-Check, Kartenaufgaben, Lernstand, Fokus-Themen, Auffrischen, Prüfungssimulation …), Anführungszeichen, Zahlen-/Datumsformate, Tonfall der Fehlermeldungen (`lotseErrorMessage.ts`), Button-Beschriftungen für gleiche Aktionen, Seitentitel. Texte aus `labels.ts` vs. inline verstreut; englische Reste in der UI. Die Katalogtexte selbst nie anfassen (amtliches Werk).
2. **Komponenten und Gestaltung.** Gegen ADR-0014 (Palette, Typografie, Muster): hartcodierte Farben, Abstände, Schatten, Radien und `z-index` statt der Tokens in `index.css`; mehrere Varianten desselben Buttons, derselben Karte, desselben Dialogs, derselben Meldung; unterschiedliche Formularmuster.
3. **Zustände.** Je Seite: Laden, leer, Fehler, Erfolg. Verhalten bei abgelaufener Sitzung (401), bei Netzfehler, bei Doppelklick; Bestätigung vor Destruktivem (Konto löschen, Verlauf zurücksetzen); begründete Disabled-Zustände.
4. **Navigation und Informationsarchitektur.** Kopf-/Fußzeile für Gäste vs. angemeldet vs. Admin, Sackgassen, fehlende Rückwege, mobile Navigation, CTA-Konsistenz zwischen Landing, Preise und Lernen, 404 und Weiterleitungen (`RETIRED_PATHS`), Admin-Oberfläche vs. Lerner-Oberfläche.
5. **Werbung und Einwilligung.** Werbeflächen nur dort, wo erlaubt (nie auf `/pricing`, `/admin`; ADR-0027), Platzierung und Layout-Sprünge, Consent-Verhalten.
6. **Zugänglichkeit im Projektrahmen.** Bar ist `eslint-plugin-jsx-a11y` (CLAUDE.md legt kein WCAG-Ziel fest). Prüfe Tastaturbedienung, Fokus in Dialogen und nach Navigation, Überschriftenstruktur (ein `h1`), Kontrast der Token-Paare (rechne nach), Alt-Texte der Katalogbilder (ADR-0033), `prefers-reduced-motion`. Ob das Barrierefreiheitsstärkungsgesetz greift, ist eine **Frage an den Betreiber** (kein Rechtsurteil): als `low` mit Konfidenz `low` notieren.
7. **Responsives Verhalten.** Breakpoints, Überläufe, Tabellen und lange Wörter auf kleinen Viewports, Touch-Zielgrößen.

## Lens `docs`

Scope: alle `*.md` (inkl. `docs/`, `docs/adr/`, `README.md`, `SECURITY.md`), Code-Kommentare, die juristischen Seiten im Frontend (`legal.ts`, Impressum, Datenschutz, AGB). Frage: stimmt es, ist es vollständig, ist der Umfang angemessen?

1. **Wahrheit gegen Code.** `ARCHITECTURE.md` (Komponenten, Routen, Modelle, „Not yet built“), `RUNBOOK.md` (Befehle und Pfade existieren; Secrets-Tabelle ↔ `render.yaml` `sync: false` ↔ `Settings` in `backend/app/core/config.py` ↔ `backend/.env.example`/`frontend/.env.example`), `README.md` (Befehle), `docs/FEATURES.md` (Preise, Live-Zustand, Flags), `docs/NON-FUNCTIONAL-REQUIREMENTS.md` (Limits ↔ Konstanten im Code), `docs/catalog-pipeline.md`, `docs/mutation-testing.md` (Scope, Scores, Laufzeiten), `CLAUDE.md` (Jobnamen ↔ Workflows, Pfade, Versionen, Hook-Namen).
2. **Owner-Tabelle.** Aussagen, die in mehr als einem Dokument stehen und auseinanderlaufen können (Zahlen, Preise, Listen, Jobnamen), gegen die Regel der `CLAUDE.md`: jedes Thema steht an genau einer Stelle.
3. **ADRs.** Index ↔ Dateien (Nummern, Titel, Statuszeilen, `test_docs.py` deckt nur Teile ab), Supersede-Ketten korrekt in beide Richtungen, referenzierte Dateien und Funktionen existieren noch, ADRs mit überholter Beschreibung ohne Nachtrag; fehlende ADRs nur für wirklich teure oder nicht offensichtliche Entscheidungen.
4. **Verfall.** Tote Links und Anker, umbenannte Pfade, „derzeit/aktuell/ab Datum“-Aussagen, die nicht mehr stimmen, `TODO`/`TBD`, Platzhalter, Reste entfernter Funktionen (z. B. des früheren Aikido-CI-Jobs).
5. **Angemessenheit.** Zu lang oder zu kleinteilig (verrottet schnell) vs. fehlend (Einstieg für neue Mitwirkende, Beitragsregeln, Zielgruppe „Produkt/Vertrieb/Fahrlehrer“ in `FEATURES.md`); Umfang und Struktur der `CLAUDE.md` als Agentenanweisung; Sprache der Dokumente einheitlich.
6. **Kommentare im Code.** Kommentare, die dem Code widersprechen, veraltet sind oder nur wiederholen, was dasteht; fehlende Begründungen an wirklich nicht offensichtlichen Stellen.
7. **Datenschutzerklärung und Rechtstexte ↔ Technik.** Datenfelder, Aufbewahrung und Auftragsverarbeiter (Umami, AdSense, Stripe, Anthropic, Better Stack, E-Mail-Versand, Hosting) so beschrieben, wie sie im Code und in `render.yaml` vorkommen; AGB-Version (`agb_accepted_*`). Kein Rechtsurteil, nur Abweichungen zwischen Text und Technik.
8. **Mechanische Absicherung.** Was `backend/tests/test_docs.py` zusätzlich prüfen könnte (Linkprüfung, Umgebungsvariablen-Parität, ADR-Verweise), wenn es einen Drift wiederholt verhindert hätte.

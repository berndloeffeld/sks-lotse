# SKS Lotse: Feature overview

What SKS Lotse can do today, in the users' terms. For product managers, sales and sailing instructors. Technical detail and reasoning are in [ARCHITECTURE.md](ARCHITECTURE.md) and the [ADRs](adr/README.md).

## At a glance

SKS Lotse is a web application for preparing for the **theory exam of the Sportküstenschifferschein (SKS)**. It runs in the browser on phone, tablet and computer, with no app store.

The official question catalog of the German federal authority (ELWIS) consists of free-text questions, not multiple choice. Learners write their own answer, compare it with the official model answer and grade themselves. The catalog is used unchanged, with ELWIS credited as the source.

What sets it apart from simply paging through the catalog:
- It tracks what a learner has **actually retained** and brings forgotten questions back.
- It offers a **Probeprüfung** (exam simulation) under time pressure.
- It walks through the official **Kartenaufgaben** task by task, with the official solutions and a worked derivation (all ten sheets), open to every learner and, without a login, to guests too.
- Optionally, an **AI check (Lotsen-Check)** gives an assessment of the learner's own answer.

## Access and account

- **Sign-in with an email address and a one-time code only.** There is no password. The email also carries a sign-in button: one click on the page it opens, and the learner is in, in that browser. Without signing in there is no progress; with it, progress is the same on every device.
- **After signing in, the learner is back where they started**: on the page that asked for the login (the pricing page, a Kartenaufgabe, a link to an exam), otherwise in the learning area. If a session runs out while a page is open, the page says so ("Deine Sitzung ist abgelaufen") instead of quietly turning into the guest view.
- **Without signing in**, "Lernen nach Thema" is open: every topic of the catalog (both Seemannschaft variants), each question with the official answer. Guests write their answer, reveal the official one, grade themselves and get the round's summary, but nothing is saved: no Lernstand, nothing sent. Fokus, Auffrischen, the Probeprüfung and the Lotsen-Check need an account.
- **Exam variant** per account: "Segeln und Motor" or "Motor". Questions are filtered accordingly.
- **Profile:** name and salutation (optional), exam variant, learning status, exam statistics, Kartenaufgaben statistics, change email address (confirmed by a code sent to the new address; the old address gets a notice), delete the account oneself.
- The terms (AGB) are confirmed once per version. That also applies on the pricing page, and a purchase is only possible with the AGB in force confirmed. For a new account that first confirmation is a welcome dialog ("Willkommen an Bord") that also names the tokens it was given for the Lotsen-Check.

## Learning

The learning area holds the three modes below and the Probeprüfung (its own section), with the overall progress above them.

**Flow of a question:** read the question, formulate an answer in the scratchpad (it stays with the learner and is sent nowhere unless they trigger the AI check), reveal the model answer, grade oneself: *Richtig*, *Teilweise richtig* or *Falsch*. Questions with figures show the image. Chart notation (e.g. in navigation questions) is rendered legibly.

**Herleitung (nicht amtlich):** for some questions whose official answer is only a result, a short derivation written by SKS Lotse (where it helps, with a sketch of our own) can be unfolded below the official answer: in practice (guests included), in the Probeprüfung once it is handed in, and in the admin question search. It says plainly that it is not part of the official catalog and that the official answer is what counts; it is not given to the Lotsen-Check.

| Mode | Purpose | How |
|---|---|---|
| **By topic** | Learn systematically | Questions are sorted by the topics of the official catalog (navigation, maritime law, meteorology, seamanship). The status per topic is visible. |
| **Focus** | Set priorities | Topics can be starred. The Focus round runs through all not yet learned questions of those topics, the one longest ago first. Once a topic is fully learned it drops out of the focus. |
| **Refresh** | Bring back what was forgotten | 20 random questions that were once learned securely. Only questions that have already "faded"; if fewer than 20 have, the session is filled up with those that fade within the next two days. |

**When does a question count as "learned"?** Not after a single correct answer. The system estimates for each question how long the answer stays in memory and adjusts that with every grading. A question counts as learned as long as the memory is expected to hold. When it fades, the question comes back. Correct answers given repeatedly and with spacing move a learner ahead faster. The interface deliberately does not show the numbers behind this; learners only see their progress.

## Probeprüfung (exam simulation)

A trial run of the theory exam's **Fragebogen**:
- 30 random questions from the chosen exam variant, spread over the subjects as in the exam (9 navigation, 7 maritime law, 5 meteorology, 9 seamanship).
- 90 minutes with a countdown. The server enforces the time, so reloading or a wrong device clock doesn't help. Answers are saved continuously.
- No tips. Model answers are only shown after submission.
- Afterwards the learner grades themselves question by question (Richtig 2 points, Teilweise 1, Falsch 0) and gets a result.
- History and statistics in the profile: number of attempts, pass rate, average, best result, latest attempts, share per subject.
- By default the self-assessment counts towards the learning status like a practice grading, "Teilweise" and "Falsch" included. A checkbox before the start switches that off (remembered for the next exam), for a pure rehearsal that changes nothing.
- Not included: the **Kartenaufgabe** (navigation on the practice chart) — see the next section.

For sailing instructors: the simulation suits self-study as a final test before the exam date.

## Kartenaufgaben (chart exercises)

The second part of the written exam, practised with the **official solved Kartenaufgaben** of the WSV (30 points each, 90 minutes in the exam). **All ten sheets** are in the app.
- Before the start the learner is told plainly what they need and what SKS Lotse doesn't provide: the practice chart **Übungskarte 49 (INT 1463)**, Karte 1/INT 1, the Begleitheft (Ausgabe 2013), plotting tools and a calculator. They confirm they have it ready. The same page holds the sheet's rules ("Hinweise zur Kartenaufgabe") and the blank Formblatt Gezeiten, each folded until opened: the rules are read there, before the start, and aren't among the tools during the run.
- The tasks come **one after another**, as on the sheet: read the task, work it out in the paper chart, note the result, see the **official solution** as text (the results with their tolerances and, for the current triangle, the official drawing), unfold the **derivation** (the tide and course tables as on the sheet, plus what the sheet leaves unsaid, such as a correction's sign or how the current triangle is constructed), give oneself 0 to the task's points, next task.
- At the end, the points given and **what they would mean in the exam**, by the Durchführungsrichtlinien SKS: from 20 of 30 "Bestanden", 17 to 19 "Mündliche Nachprüfung erforderlich", 16 or fewer "Nicht bestanden" — for learners and guests alike.
- The answer can hold **a table** (inserted from the answer editor; rows and columns can be added and removed). It shows as a table in the run, its history and the result, and the Lotsen-Check reads it row by row.
- Each sheet links a **video walk-through on YouTube** (channel McFly439; linked only, nothing of YouTube is loaded until it is clicked). During a run it is the first tool, started at the current task.
- Always at hand during a run: the **Formblatt Gezeiten to fill in** on screen (kept in the learner's browser per run; the blank original can be printed), the **current task as the official PDF prints it**, with its official solution once answered, and every task done so far with one's own answer and the solution.
- The overview shows one tile per sheet with its tour (e.g. "Cuxhaven → Büsum") and what it practises, in our own words, and whether the sheet is untouched, begun, or the points of the last completed run. A begun run can be discarded to start over, a finished one deleted. The runs don't change which questions count as learned; the Lernstand page has a statistics section of their own: number of runs, how many passed, average and best points, every completed run over time with its exam verdict, and per sheet how often it was worked with the last and best points.
- **Lotsen-Check for a task** (with an account): after the solution, the Lotse can look at the answer for **2 tokens**. It suggests the points the task would have earned, says what is right and what is missing, and **guesses where the learner went wrong**, recomputing their number from the official derivation (a correction with the wrong sign, MESZ forgotten, decimal hours read as minutes, a follow-on error from an earlier task, …). The suggestion picks its points, the learner gives them. Once per task; it stays with the run and is shown again later. Not offered for the task where the current triangle is drawn, and for guests only as a preview.
- No time limit.
- **Without a login**: the list and every sheet's page are open to guests, and a guest works through a whole sheet the same way, task by task with the official solution and their own points. Nothing is saved on the server: answers and points are gone when the page is left, and a run can't be interrupted. Only the Formblatt Gezeiten stays in the guest's browser until the same sheet is started again, the form is cleared, or someone signs out. Leaving a run in progress asks first. Below every sheet, all its tasks with their official solutions to unfold, for search engines and to look one up.

Status today: **open to everyone, guests included** (`CHART_EXERCISES=on` since 2026-10-02; the usage rights of the WSV material are cleared since 2026-10-01). The landing page previews them with a screenshot and links to them.

## Lotsen-Check (AI assessment)

Learners can have their own answer checked by the "Lotse". An AI (Claude by Anthropic) compares it with the model answer and **suggests a grade with a short explanation**. For a partly right or wrong answer it adds a checklist: what the learner already named (✓) and what is still missing or contradicts the model answer (✗), at most four points each. A right answer gets only a short confirmation. Something the learner adds beyond the question is judged against the catalog: if the official answers of the same topic confirm it, it costs nothing; if it contradicts them, it counts against the answer. The decision always stays with the learner.

- Costs **1 token** per catalog question, **2 tokens** per Kartenaufgabe task (a stronger model that recomputes the learner's numbers; see above). The price is shown on the button. New accounts get a starting balance: the landing page names it under its hero sign-up button (not the login form, which returning learners use too), the welcome dialog at the first login again; more tokens are available in packages.
- Only the question, the model answer and the learner's answer (at most 1,000 characters) are sent, plus the official questions and answers of the same topic, nothing personal. For a Kartenaufgabe, instead of the topic, the official derivation and the learner's answers to the earlier tasks of the same run, so follow-on errors are recognised. Processing happens at Anthropic in the USA, under a data processing agreement.
- Abuse protection: at most 2 checks per question and day, an hourly limit, protection against injected instructions. If a check fails technically, the token is refunded; a check turned away by the hourly limit or for lack of tokens doesn't count towards the per-question limit.
- If the AI is unavailable, learning continues as normal; only the check is missing.

## Buying and prices

One add-on, and no advertising:
- **Free for good** is the basic function the AGB name (section 4): practising questions, the official answers and the learning status. The Kartenaufgaben and the Probeprüfung are free today as well; the pricing page says it the same way ("derzeit").
- **Tokens for the Lotsen-Check** in four packages (starting prices: S 20 tokens 2.99 €, M 50 tokens 5.99 €, L 100 tokens 9.99 €, XL 200 tokens 16.99 €), with a free starting balance for new accounts (10 tokens at the moment). Payment via Stripe (credit card and other methods), and a confirmation email follows the purchase. The operator can change the prices and the starting balance, and the prices are shown publicly on the pricing page.

Status today: buying tokens is open to all learners (the live state of the flag is kept in the [RUNBOOK](RUNBOOK.md#settings-that-live-only-in-dashboards)).

## Feedback and quality

- **Report a question:** under every question a fault can be reported (question text, answer text, typo, missing image, other). The operator sees the most reported questions in the daily report.
- **Feedback** via the email link "Kontakt" in the footer.

## Navigation

- Without a login, the header has **Lernen**, **Kartenaufgaben** and **Preise**, plus Anmelden.
- Logged in, it follows the written exam's two parts: **Fragen** (the learning area, Probeprüfung included) and **Kartenaufgaben** (switched off: **Lernen** and **Probeprüfung**), next to the token balance and the **Konto** menu (Lernstand, account settings, buying tokens, Admin for admins, sign-out).
- **Prüfungsablauf**, **Lernmethode**, **FAQ** and **Kontakt** are in the footer of every page. On phones the areas are a tab bar at the bottom, hidden while a round, an exam or a Kartenaufgabe runs.
- An address that doesn't exist, or an unknown topic or Kartenaufgabe, says **Seite nicht gefunden** and links to the matching overview.

## Public pages

- Landing page, pricing, FAQ, "So läuft die SKS-Prüfung ab" (Prüfungsablauf), "SKS-Fragenkatalog lernen mit dem Karteikarten-Prinzip" (Lernmethode), imprint, privacy policy and terms; the topic list with one page per topic of "Lernen nach Thema" (25 topics, every question with its official answer to unfold); the Kartenaufgaben list with one page per sheet.
- The landing page's hero puts one official question to try beside the promise, without a login: answer, show the official one, grade yourself, then on to its topic or another sample (four, one per exam subject; nothing is saved). The page also previews the Kartenaufgaben with a screenshot and links to them.
- All public pages are prepared for search engines and AI answer engines, which may fetch and cite them, and are listed in the sitemap.
- The exam-process page answers the common exam questions in short form, also as structured data, and recommends the Segelschule Altwarp for the practical side and charter: the operator's personal tip, unpaid (no commission, discount or other consideration), with what makes the Stettiner Haff a training area for SKS navigation.
- The learning-method page explains in plain words why repeating at growing intervals beats reading through once (forgetting curve, flash-card principle, half-life of an answer, when a question counts as learned, the three modes), with three schematic figures, practical tips and a short Q&A, also as structured data. It names no numbers of the model, on purpose, and the figures have no scale either.

## Privacy

- Access with an email address only, no password. No advertising and no cookies beyond the session cookie of a logged-in account, so there is no consent banner.
- App and database hosted in Frankfurt (EU); the static pages are delivered through Render's global CDN. Usage analytics without cookies, for guests as well.
- Learners can delete their account and all learning data at any time themselves. Access and data export are handled on request through the operator.

## Operator tools (not for learners)

Protected by an allowlist and a two-factor code (authenticator app):
- Search, view, export, delete and block accounts; credit tokens by hand, take them back after a refund or chargeback (never below 0).
- Blocklist for email addresses and domains against abuse; a blocked address is deleted automatically 24 months after the block, a domain stays until removed.
- Set prices and packages.
- Search questions and model answers across the whole catalog (by text, number, subject and topic), and see per question who graded it when, how, and which memory estimate (half-life) came of it (recorded since this view went live).
- Daily KPI report by email (growth, activity incl. Kartenaufgaben, learning success, quality, Lotsen-Checks with the tokens they cost, Stripe purchases and revenue); a maintenance mode for when something goes wrong.
- Overview page, the first thing the admin area shows: the report's growth, activity and Lotsen-Check/revenue figures as of now, with a bar chart per day over the last 7, 30 or 90 days (sign-ups, active learners, gradings, Lotsen-Checks, tokens, purchases, revenue). Sums only, no single account.

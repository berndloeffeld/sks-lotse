# SKS Lotse: Feature overview

What SKS Lotse can do today, in the users' terms. For product managers, sales and sailing instructors. Technical detail and reasoning are in [ARCHITECTURE.md](ARCHITECTURE.md) and the [ADRs](adr/README.md).

## At a glance

SKS Lotse is a web application for preparing for the **theory exam of the Sportküstenschifferschein (SKS)**. It runs in the browser on phone, tablet and computer, with no app store.

The official question catalog of the German federal authority (ELWIS) consists of free-text questions, not multiple choice. Learners write their own answer, compare it with the official model answer and grade themselves. The catalog is used unchanged, with ELWIS credited as the source.

What sets it apart from simply paging through the catalog:
- It tracks what a learner has **actually retained** and brings forgotten questions back.
- It offers an **exam simulation** under time pressure.
- Optionally, an **AI check (Lotsen-Check)** gives an assessment of the learner's own answer.

## Access and account

- **Sign-in with an email address and a one-time code only.** There is no password. Without signing in there is no progress; with it, progress is the same on every device.
- **Exam variant** per account: "Segeln und Motor" or "Motor". Questions are filtered accordingly.
- **Profile:** name and salutation (optional), exam variant, learning status, exam statistics, change email address (confirmed by a code sent to the new address), delete the account oneself.
- The terms (AGB) are confirmed once per version.

## Learning

The learning area has three modes, shown as tabs, with the overall progress above them.

**Flow of a question:** read the question, formulate an answer in the scratchpad (it stays with the learner and is sent nowhere unless they trigger the AI check), reveal the model answer, grade oneself: *Richtig*, *Teilweise richtig* or *Falsch*. Questions with figures show the image. Chart notation (e.g. in navigation questions) is rendered legibly.

| Mode | Purpose | How |
|---|---|---|
| **By topic** | Learn systematically | Questions are sorted by the topics of the official catalog (navigation, maritime law, meteorology, seamanship). The status per topic is visible. |
| **Focus** | Set priorities | Topics can be starred. The Focus round runs through all not yet learned questions of those topics, the one longest ago first. Once a topic is fully learned it drops out of the focus. |
| **Refresh** | Bring back what was forgotten | 20 random questions that were once learned securely. At least 70 % of them have already "faded", the rest fade within the next two days. |

**When does a question count as "learned"?** Not after a single correct answer. The system estimates for each question how long the answer stays in memory and adjusts that with every grading. A question counts as learned as long as the memory is expected to hold. When it fades, the question comes back. Correct answers given repeatedly and with spacing move a learner ahead faster. The interface deliberately does not show the numbers behind this; learners only see their progress.

## Exam simulation

A trial run of the theory exam's **Fragebogen**:
- 30 random questions from the chosen exam variant, spread over the subjects as in the exam (9 navigation, 7 maritime law, 5 meteorology, 9 seamanship).
- 90 minutes with a countdown. The server enforces the time, so reloading or a wrong device clock doesn't help. Answers are saved continuously.
- No tips. Model answers are only shown after submission.
- Afterwards the learner grades themselves question by question (Richtig 2 points, Teilweise 1, Falsch 0) and gets a result.
- History and statistics in the profile: number of attempts, pass rate, average, best result, latest attempts, share per subject.
- Correctly answered questions count towards the learning status.
- Not included: the **Kartenaufgabe** (navigation on the practice chart).

For sailing instructors: the simulation suits self-study as a final test before the exam date.

## Lotsen-Check (AI assessment)

Learners can have their own answer checked by the "Lotse". An AI (Claude by Anthropic) compares it with the model answer and **suggests a grade with a short explanation**. The decision always stays with the learner.

- Costs **1 token** per check. New accounts get a starting balance; more tokens are available in packages.
- Only the question, the model answer and the learner's answer (at most 1,000 characters) are sent, nothing personal. Processing happens at Anthropic in the USA, under a data processing agreement.
- Abuse protection: at most 2 checks per question and day, an hourly limit, protection against injected instructions. If a check fails technically, the token is refunded.
- If the AI is unavailable, learning continues as normal; only the check is missing.

## Buying and prices

Two independent add-ons, valid in any combination:
- **Tokens for the Lotsen-Check** in four packages (starting prices: S 20 tokens 2.99 €, M 50 tokens 5.99 €, L 100 tokens 9.99 €, XL 200 tokens 16.99 €), with a free starting balance of 6 tokens. Payment via Stripe (credit card and other methods), and a confirmation email follows the purchase. The operator can change the prices, and they are shown publicly on the pricing page.
- **Ad-free** (one-time payment, starting price 5 €). Without it, ads are planned to be shown later.

Status today: buying tokens is open to all learners. Ad-free is still credited by hand, and no ads are shown yet.

## Feedback and quality

- **Report a question:** under every question a fault can be reported (question text, answer text, typo, missing image, other). The operator sees the most reported questions in the daily report.
- **Feedback** via an email link in the menu, "Kontakt" in the footer.

## Public pages

Landing page with a feature overview, pricing, FAQ, "Ablauf der Prüfung" (exam process), imprint, privacy policy and terms. They are prepared for search engines.

## Privacy

- Access with an email address only, no password, no passing of data to advertising networks without consent; ad consent is managed through the cookie settings in the footer.
- Hosted in Frankfurt (EU). Usage analytics without cookies.
- Learners can delete their account and all learning data at any time themselves. Access and data export are handled on request through the operator.

## Operator tools (not for learners)

Protected by an allowlist and a two-factor code (authenticator app):
- Search, view, export, delete and block accounts; credit tokens or ad-free by hand.
- Blocklist for email addresses and domains against abuse.
- Set prices and packages.
- Search questions and model answers across the whole catalog.
- Daily KPI report by email; a maintenance mode for when something goes wrong.

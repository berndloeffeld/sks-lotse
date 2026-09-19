# 0024. Course gauge: per-question progress without a visible step count

Status: Accepted

## Context

[ADR-0014](0014-visual-design-system.md) specified the per-question "Lot gauge": a short line **with tick marks** and a dot that advances with each correct answer. [ADR-0023](0023-self-assessed-learning-flow.md) built it that way, with one tick per consecutive "Richtig" that "gelernt" takes. It also added a text line after each grading ("2 von 3 Mal in Folge richtig.").

Both give away the rule at a glance: learners can count the ticks, or read the text, and learn exactly how many correct answers finish a question. That invites working toward the number instead of the content. The method itself (3 consecutive "Richtig", [ADR-0018](0018-learning-progress-model-and-gelernt-streak-rule.md)) is also expected to change, so the UI shouldn't be built around it.

Options considered (explored as mockups): stepped designs (three fields, a sounding line with depth marks, a three-segment ring) and stepless ones (a filling gauge, a boat sailing toward a harbour, a lighthouse beam). All stepped designs were rejected for the reason above.

## Decision

- Per-question progress is shown as **"Kurs auf den Hafen"** (`CourseGauge`): a boat on a markless dashed course toward an anchor. It sits in the question's header row, on the right, and replaces the Lot gauge. This is the route-line-with-boat idea ADR-0014 had already sketched for mobile.
- **Colors come from the existing tokens:** the boat is in `primary` while sailing. At "gelernt" it lies at anchor, and boat, course and anchor turn `success`, the same green the `/learn` progress bars use for "gelernt". `accent` stays reserved for the page's one action button.
- **No step count anywhere in the UI:** no ticks, no segments, no "x von 3" text. The "alles gelernt" message no longer names the number either. The gauge takes a 0–1 `progress`. The frontend derives it in one place, `streakProgress()` in `src/progress.ts`, and that is also the only frontend code that knows the threshold. While sailing, the boat stops short of the anchor, so "almost learned" never reads as "learned".
- **The movement is the feedback:** after a grading the boat glides (700 ms) forward, or back to the start on a reset, instead of a text line appearing. Screen readers get a visually hidden status message ("Richtig – ein Stück näher am Ziel." / "Zurück zum Start – die Frage kommt wieder." / "Gelernt."), and the gauge's label is qualitative too ("Noch nicht gelernt" / "Auf Kurs zu gelernt" / "Gelernt"). With `prefers-reduced-motion` the boat jumps instead of gliding.
- The gauge is remounted per question, so moving to the next question doesn't animate a boat across from the previous one's position.

## Consequences

- A new method (e.g. spaced repetition, AI grading) only has to change how `progress` is computed. The gauge stays as it is. The API still returns `correct_streak`. If the frontend ever shouldn't know the threshold at all, the next step is the backend returning a 0–1 progress value instead.
- Learners can still roughly infer the count by watching how far the boat moves per answer. The goal is only that it isn't readable at a glance, not that it's secret.
- The dashed course (`border` color) is faint on the page background. That's acceptable because the boat carries the information, not the line.
- ADR-0014's "Lot gauge" bullet is superseded by this ADR. The rest of ADR-0014 stands.

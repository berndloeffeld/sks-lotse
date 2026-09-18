# 0014. Visual design system: palette, typography, and core UI patterns

Status: Accepted

## Context

[ADR-0013](0013-frontend-architecture-and-tooling.md) deliberately deferred the visual design system ("color palette, typography, spacing, logo/branding") to its own session "once there's real branding to work from." This is that session.

The design was explored as a canvas of interactive HTML mockups covering the core learning flow (Start, Fragenliste, Frage beantworten, Bewertung), responsive breakpoints (mobile/tablet/desktop), email+OTP login, the ads/premium monetization split ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)), and a logged-out marketing landing page. Direct competitors already exist with similar AI-graded free-text flows (see CLAUDE.md → Naming/Domain); early iterations leaned too close to one competitor's visual pattern — colored full-width action bars, colored circle progress dots, rounded app-store card chrome — and were revised toward a more distinctive identity after explicit feedback.

The mockups themselves live in a private, external design tool (interactive HTML artboards), not in this repository — they were a working exploration, not a deliverable to check in. This ADR is the durable, self-contained record of what was decided; the values below are exact enough to seed a Tailwind config directly without needing to consult that external artifact.

## Decision

**Concept**: "Chart & log" — nautical without leaning on compass-rose clichés. A cool, misty sea-blue-grey base (light, but not white) with a faint bathymetric contour-line texture, flat ink-bordered "chart tile" components instead of rounded colored cards, and instrument metaphors used sparingly, only where they genuinely fit (see the Lot gauge below).

**Color tokens** (hex — map directly to Tailwind `theme.colors` / CSS variables):

| Token | Hex | Use |
|---|---|---|
| `bg` | `#E9F0F3` | page background |
| `surface` | `#FFFFFF` | cards |
| `surface-alt` | `#D8E4E9` | secondary panels, unselected chips |
| `border` | `#B9C9D0` | hairlines |
| `ink` | `#1E2A32` | primary text, primary buttons/borders |
| `ink-soft` | `#5B6670` | secondary text |
| `primary` | `#1F6F78` | links, active nav, progress fill |
| `primary-dark` | `#164F56` | hover state for primary |
| `accent` | `#B8763C` | "in progress" / partial-credit state |
| `success` | `#3D7A5C` | "gelernt" / correct state |
| `danger` | `#B24632` | errors, "falsch" |

**Typography**: `Fraunces` (serif, headings) + `Public Sans` (sans, body/UI) + `IBM Plex Mono` (question numbers, percentages, nav labels — anything that should read like a logbook entry). Deliberately not Inter/Roboto/Arial. All three load from Google Fonts. *(Amended by [ADR-0021](0021-self-hosted-web-fonts.md): now self-hosted via `@fontsource/*`, no longer loaded from Google Fonts.)*

**Corners & chrome**: flat, mostly square-cornered (0–2px radius), 1–1.5px hairline borders — not the rounded-card/colored-pill idiom common to competitor apps and generic mobile UI kits.

**Core reusable components** (candidates for the first shared component set once scaffolding starts):
- **Chart tile**: an ink-bordered rectangle with a dog-eared corner fold, used for primary navigation actions (Lernen / Prüfungssimulation) instead of solid-color full-width bars.
- **Lot gauge**: the per-question learning-progress indicator — a short horizontal line with tick marks and a moving dot that advances with each correct answer, becoming a small anchor glyph at "gelernt". Visualizes the 3-consecutive-correct rule (see Consequences) and resets to empty on any non-"Richtig" grading.
- **Ledger list rows**: flat rows separated by hairlines (not boxed cards) for categories/questions, with counts set in `IBM Plex Mono`.
- **Self-assessment control**: three plain radio buttons stacked vertically, in the order Richtig / Teilweise Richtig / Falsch — no color-coding, no icons. This is the result of rejecting several more elaborate variants (see Consequences).
- **Ad slot**: a dashed-border placeholder box labeled "ANZEIGE" in mono type, deliberately styled to look distinct from app content, never native — appears on Start, Fragenliste, Frage beantworten, Bewertung, and the free-tier pricing card on the landing page.
- **Tip reveal**: an optional "Tipp anzeigen" control on the answer screen; revealing it caps that attempt's grading at "Teilweise Richtig" (see Consequences), shown as an inline warning once revealed, before submission.

**Responsive strategy**: mobile and tablet keep a bottom tab bar (Start / Suche / Konto). Desktop (~1280px+) switches to a persistent left sidebar with the same nav items; screens gain a second column where there's room for it — e.g. the desktop "Frage beantworten" layout adds a right-hand "aktueller Lauf" rail listing the run's other questions with their own Lot gauges, replacing the mobile route-line-with-boat-icon progress indicator, which only made sense as a compressed strip.

**Screens explored** (not yet built): Start, Fragenliste, Frage beantworten (+ desktop variant, + a "mit Tipp genutzt" grading variant), Bewertung, Start/Fragenliste/Frage beantworten at tablet and desktop widths, Start with an ad slot, two-step email+OTP login, and a logged-out marketing landing page.

## Consequences

- `tailwind.config.js` can be seeded directly from the color table and font stack above once frontend scaffolding starts ([ADR-0013](0013-frontend-architecture-and-tooling.md)) — no further palette/type decisions are needed first.
- The Lot gauge, ledger rows, and chart-tile pattern should be among the first shared components built, since nearly every screen uses at least one of them.
- Two product rules surfaced during this design pass and directly shape the Lot gauge and the grading flow, but affect a questions/progress data model that doesn't exist yet: (1) "gelernt" requires 3 **consecutive** "Richtig" gradings — a "Teilweise Richtig" or "Falsch" grading resets that question's streak to 0, it is not a cumulative count; (2) revealing a question's optional tip (text or image) disables "Richtig" as a possible outcome for that attempt, capping it at "Teilweise Richtig", to prevent gaming rule (1) by peeking at a hint. Both need an ADR of their own once the grading/progress backend work actually starts.
- The mockups' Google/Facebook/X sign-in buttons use generic placeholder monograms, not each provider's actual logo or brand assets. Real implementation should use each provider's official sign-in button component and follow its brand guidelines, not recreate this placeholder styling.
- Rejected: a warm sand/canvas palette (first iteration) — read too close to earthy "paper" schemes used elsewhere in this space; moved to the cooler sea-blue-grey above after direct feedback.
- Rejected: a semicircular "engine telegraph" dial, and separately a bordered 3-cell segmented control, for the self-assessment step — both felt bulky and out of place next to the plain hairline-separated sections around them. A bare vertical radio list, with no color or icon coding, was simpler and read better.
- Rejected: color-coding (red/amber/green) and icon glyphs (✕ / half-filled circle / ✓) for the three grading outcomes — plain text labels only, to avoid leaning on color as the only signal and to avoid another "traffic light" cliché already used by competitors.
- The design canvas itself is not preserved in this repository; this ADR is the source of truth if that external link is ever lost. Screens can be reconstructed from the tokens and component descriptions above if needed.

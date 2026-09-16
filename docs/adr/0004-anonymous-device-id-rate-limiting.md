# 0004. Anonymous device-ID rate limiting for grading requests

Status: Superseded by [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)

## Context

Grading calls OpenAI per request (see [ADR-0003](0003-synchronous-grading-requests.md)), which costs money per call. The app is anonymous-by-default (no login required, per `CLAUDE.md`), so there's no authenticated identity to attach a quota to, and nothing client-side can be trusted as a limit enforcement mechanism — a learner (or a script) can always ignore or clear client-side state. Without some form of abuse protection, a single anonymous visitor could drive unbounded OpenAI spend.

Options considered:
1. **IP-based rate limiting** — simplest to implement, but inaccurate: multiple learners behind the same NAT/corporate network share a limit, and it's trivially bypassed with a VPN.
2. **Anonymous device ID + server-side counter** — issue a random ID via an httpOnly cookie on first visit, track a request counter for that ID server-side (Postgres), reset on a rolling or daily window.
3. **No protection for now** — ship the MVP faster, add protection reactively if abuse is observed.

## Decision

Use an **anonymous device ID + server-side counter**: on first request, issue a random opaque ID via an httpOnly, secure cookie (not readable/forgeable from client JS). The grading endpoint looks up (or creates) a counter row for that ID and rejects the request once a daily threshold is exceeded, returning a clear error rather than silently degrading.

Specific threshold values, the exact counter table schema, and the reset-window mechanics (rolling 24h vs. calendar day) are implementation details to be settled when the grading endpoint is actually built — not fixed by this ADR.

## Consequences

- More accurate than IP-based limiting (no false sharing across NAT'd users, no easy bypass via IP rotation) — though still bypassable by clearing cookies, which is an accepted gap: this deters casual/incidental abuse, not a determined attacker. A determined attacker requires either login-gating grading entirely or a CAPTCHA-style challenge, both of which raise friction for legitimate anonymous users and are deliberately out of scope here.
- Requires a new DB table (or equivalent) and a bit of request-handling logic before the grading endpoint can ship — small, but real, added scope compared to shipping with no protection at all.
- The device-ID cookie is a natural hook for later anonymous-to-logged-in progress migration (see the open auth question in `docs/ARCHITECTURE.md`), even though this ADR only covers its use for rate limiting.
- Revisit if: observed abuse patterns show cookie-clearing is actually happening at a cost-relevant scale, at which point login-gating or a challenge step would need reconsideration.

# 0006. Mandatory login and feature-gated monetization

Status: Accepted — the AI-grading add-on's boolean unlock is superseded by [ADR-0043](0043-token-based-ai-grading-monetization.md) (pay-per-use tokens); the rest stands

## Context

`CLAUDE.md` originally specified two MVP assumptions: (1) the app is anonymous-by-default, with login optional only for cross-device progress sync, and (2) monetization is single-tier — ad-financed by default, with the only paid option being ad removal, and no feature gating. [ADR-0004](0004-anonymous-device-id-rate-limiting.md) built its anonymous-abuse-protection design directly on assumption (1).

Both assumptions are being replaced, before Phase 1 (catalog import + grading flow) implementation starts:
- The app now requires login for all use — no anonymous access.
- AI-based grading — the core differentiator vs. SKS-Buddy and the official SKS App, per `CLAUDE.md` — becomes a paid, feature-gated capability rather than being available to everyone for free.

Options considered for what a non-paying, non-AI-grading learner sees instead of a graded answer:
1. Show the official model answer directly for self-assessment (no LLM call, no writing requirement).
2. Still require the learner to write an answer, then show the model answer for self-comparison.
3. Withhold the catalog's official answers entirely from free accounts (subscription-only content).

Options considered for how "remove ads" and "unlock AI grading" relate to each other:
1. Bundle both into one paid tier.
2. Sell them as two independent add-ons.

## Decision

- **Login is mandatory** to use the app at all. Sign-in via SSO (Google, Facebook, or X) or via email + OTP (passwordless). A JWT-based session is issued after successful sign-in — the same mechanism `CLAUDE.md` already named for optional cross-device sync, now backing every session instead of only synced ones.
- **Monetization is freemium, with "remove ads" and "unlock AI-based grading" sold as two independent, separately purchasable add-ons** (option 2 above) — not bundled into a single paid tier. All four combinations (ads/no-ads × AI/no-AI) are valid.
- **Free-tier learners without AI grading see the official model answer directly** (option 1 above) — no LLM call, no forced writing step. They can still read/compare, just without automated scoring.
- Because every user is now authenticated, **ADR-0004's anonymous device-ID rate limiting is superseded**: usage quotas for the (now paid) AI-grading feature can be tied to the authenticated account instead of an anonymous cookie-based device ID. Specific quota/threshold mechanics are an implementation detail for when the grading endpoint and entitlement system are actually built.

## Consequences

- Every learner must create an account before using the app at all — removes the previous zero-friction anonymous entry point that partly motivated anonymous-by-default access in the first place.
- Progress is now server-side and per-account for all users, not just those who opted into sync — simplifies the data model (one storage path instead of anonymous-browser-storage + optional-sync), but the "anonymous, progress kept in browser" fallback described in `CLAUDE.md` no longer exists.
- Entitlement state (ads removed? AI grading unlocked?) must be modeled per account and checked wherever ads render or the grading endpoint is called — new scope not present in the original single-tier design.
- ADR-0004's device-ID cookie is no longer needed for its original purpose. Its own text also flagged the cookie as "a natural hook for later anonymous-to-logged-in progress migration" — that migration path is now moot too, since there's no anonymous state to migrate from.
- SSO requires registering and maintaining OAuth apps with Google, Meta (Facebook), and X, plus the email+OTP path — meaningfully more auth surface than the single JWT-login system originally planned. Provider client IDs/secrets and the OTP delivery mechanism (e.g. transactional email) are new required env vars/services, not yet chosen in detail (see `CLAUDE.md` → Environment Variables).
- The original differentiation claim in `CLAUDE.md` ("single-tier, ad-financed, no feature gating" vs. competitors that already offer AI-graded free text) no longer holds — SKS Lotse's free tier no longer includes AI grading at all, while the cited competitors apparently do. This is a real reduction in the free-tier value proposition relative to the original concept and is worth revisiting, but is accepted here as a deliberate trade for controlling OpenAI cost exposure via paid gating instead of the rate-limiting approach in ADR-0004.
- Revisit if: OAuth provider integration proves disproportionately costly for a solo-maintained MVP relative to a simpler email+OTP-only login (dropping SSO) — an implementation-detail question, not one that blocks this ADR's premise that login is mandatory either way.

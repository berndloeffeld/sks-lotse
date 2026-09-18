# 0016. Umami Cloud for analytics, no consent banner

Status: Accepted

## Context

`CLAUDE.md`'s tech stack table named Countly Flex Free ("EU private cloud, bis 500 MAU") as the analytics choice. Setting it up in practice showed that tier is a 14-day trial, not a durable free plan — not a fit for a solo, pre-launch project at this scale. Countly also does cookie/device-ID-based tracking, which triggers TTDSG §25 consent requirements — a Klaro consent banner was being evaluated alongside it for that reason, and both `countly-sdk-web` and `klaro` were briefly `npm install`ed on the frontend.

Options considered:
1. **Umami Cloud (Hobby plan)** — hosted, permanently free (100k events/month, 3 sites), cookieless: no persistent identifier, no cross-session tracking. EU region available.
2. **Self-hosted Umami or Plausible on Render** — same cookieless properties, free as software, but needs an additional Render web service (+ DB) to operate. More data-residency control (Frankfurt vs. Umami's EU region), but real ongoing operational burden for a solo project, with no concrete benefit at this scale over the hosted EU option.
3. **Keep Countly** — rejected: not durably free (14-day trial), and cookie/device-ID-based, so it would still need a consent banner.
4. **PostHog (free tier)** — generous free tier, but cookie/session-based product analytics (feature flags, session replay) — would reintroduce the consent-banner requirement this decision is trying to avoid, and is heavier than "how many learners come back" needs.
5. **GoatCounter** — free tier is non-commercial-use only. SKS Lotse plans monetization (ads + paid AI-grading unlock, see `CLAUDE.md` → Monetization), so this wouldn't stay free once that lands.

## Decision

**Umami Cloud, Hobby plan** (option 1). Because it's cookieless, it doesn't need consent under TTDSG — legal basis is legitimate interest (Art. 6(1)(f) DSGVO), disclosed in the Datenschutzerklärung. **No consent banner is built** — Klaro is dropped, and `countly-sdk-web`/`klaro` are removed from `frontend/package.json`.

The tracking script is loaded via a small `frontend/src/analytics.ts` helper (`initAnalytics()`, called once from `main.tsx`), gated on `VITE_UMAMI_WEBSITE_ID` being set — unset in local dev/CI (`frontend/.env.example`), so dev/test traffic is never counted. In production, the website id is set as a Render dashboard `sync: false` env var rather than a committed `value:` in `render.yaml`. It isn't a security secret — the id is visible to any visitor via view-source on the deployed site, same as a Google Analytics measurement id — but it's kept out of the repository anyway, since this project may go open-source and a committed value would be a zero-effort grep instead of something a bad actor has to visit the live site to find.

## Consequences

- No consent-banner infrastructure to build or maintain right now. If a future feature needs one (e.g. Google AdSense, which is cookie-based), that's its own decision at that point — not pre-built here.
- The Datenschutzerklärung (`frontend/src/pages/PrivacyPage.tsx`) must disclose Umami under legitimate interest, and note it's cookieless/no re-identification — done as part of this change, alongside the site's first Impressum/Datenschutzerklärung pages generally.
- Capped at 100k events/month on the Hobby plan — fine at the ≤500 MAU scale the stack was already scoped for (previously via Countly's own free-tier cap), revisit if traffic outgrows it.
- Rejected self-hosting (option 2): would add a Render service + DB to operate for a solo project, purely to gain data-residency control that isn't needed yet.
- The website id is not committed to `render.yaml` (kept `sync: false`) purely for open-source-repo tidiness, not because it's sensitive — it ships to every visitor's browser regardless.

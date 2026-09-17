# 0016. A third, paid Custom Domain — not a cross-site cookie workaround

Status: Accepted

## Context

[ADR-0015](0015-frontend-deployment-topology.md) planned `api.sks-lotse.de` as a Custom Domain on the backend, same-site with the frontend on `sks-lotse.de`, per [ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)'s `SameSite=Lax` cookie. Rolling it out hit a constraint neither ADR anticipated: the Render account's plan includes only **2 Custom Domains total for the whole account** — not 2 per service — with a domain's `www` variant bundled into its one slot rather than counted separately. `sks-lotse.de` (frontend) and `sks-lotse.com` (backend) already spent both slots, leaving no room for a third domain.

Two ways around that were tried and reverted before this ADR:
1. **Drop `www.sks-lotse.com`** — based on an initial (wrong) read that the cap was 2 *per service*. Didn't apply once the real, account-wide cap was understood; the domain was never actually removed in Render.
2. **Route the frontend to the backend's default `https://sks-lotse-backend.onrender.com` URL instead of a custom subdomain**, no new domain needed. This worked, but made the session cookie genuinely cross-*site* (different registrable domains, not a subdomain of the same one), forcing `SameSite=None` + unconditional `Secure`. That reopens two real risks: (a) the CSRF protection ADR-0012 got "for free" from `SameSite=Lax` + same-site now depends entirely on the API staying JSON-only and CORS staying a strict, non-wildcard allowlist — true today, but a fragile assumption for every future endpoint to keep honoring; (b) Safari (and every iOS browser, since Apple mandates WebKit) blocks third-party cookies by default, and Chrome/Firefox are moving the same direction — a cross-site cookie risks simply not working for a meaningful share of real users, silently, with no test in this repo's suite that would catch it (`TestClient` doesn't model browser cookie-jar/third-party policy at all).

A third Custom Domain on Render costs **$0.25/month** (~$3/year) — small enough that paying for it and keeping the simpler, safer same-site design outright beats either workaround above.

## Decision

Pay for `api.sks-lotse.de` as a third Custom Domain on the backend service. This makes [ADR-0015](0015-frontend-deployment-topology.md)'s original plan — same-site subdomain split, `SameSite=Lax` — the actual, implemented topology; no application code changed from what ADR-0012 originally specified.

## Consequences

- ~$3/year in exchange for not carrying the CSRF-assumption fragility or the Safari/WebKit cookie-blocking risk described above. Worth it at this scale.
- `render.yaml`'s `VITE_API_BASE_URL` is `https://api.sks-lotse.de`; the session cookie stays `SameSite=Lax`, `Secure` only in production (unchanged from ADR-0012's original code).
- If the Render account ever needs a domain for something else and hits the 3-domain ceiling again, the same trade-offs from this ADR's Context apply — re-read this before reaching for a workaround instead of paying for another slot.

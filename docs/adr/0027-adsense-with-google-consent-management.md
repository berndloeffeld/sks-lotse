# 0027. Google AdSense behind Google's own consent management

Status: Accepted (partially supersedes the "no consent banner" consequence of [ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md))

## Context

Monetization ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) includes ads for accounts that haven't paid to remove them, and AdSense is the chosen network. AdSense stores and reads cookies and shares IP/device data with Google, so § 25 TDDDG and Art. 6(1)(a) DSGVO require prior consent; for EU/EEA visitors Google additionally requires a Google-certified CMP implementing the IAB TCF. ADR-0016 explicitly deferred this: "if a future feature needs [a banner] (e.g. Google AdSense), that's its own decision at that point".

Options considered:
1. **Google's own consent management** (AdSense → Privacy & messaging) — free, TCF-certified, no third-party vendor, configured in the AdSense dashboard and delivered by the AdSense script itself.
2. **Third-party CMP** (Cookiebot, Usercentrics, Klaro with TCF, …) — more control over wording/design and consent for non-Google services, but another processor, paid beyond a traffic threshold, and one more script to load and keep TCF-compliant.
3. **Self-built banner** — not accepted by Google for AdSense in the EEA (needs a certified CMP), so a non-starter.

## Decision

**Option 1.** The `adsense-snippet` plugin in `frontend/vite.config.ts` injects the AdSense `<script>` into the built HTML `<head>` only when `VITE_ADSENSE_CLIENT_ID` is set — unset in local dev/CI, set in production via a Render `sync: false` variable, the same gating and reasoning as `VITE_UMAMI_WEBSITE_ID`. It is a static tag in the served HTML (not injected at runtime) because AdSense's site verification reads the page source; `prerender.mjs` derives both the landing page and the SPA shell from that build output, so every page carries it. `ads.ts` holds the runtime helpers (`adsEnabled()`, `openConsentSettings()`). `public/ads.txt` declares the publisher id (public by design). The consent message is created in the AdSense dashboard; the script shows it and withholds personalised ads until the visitor has chosen.

Withdrawal must be as easy as consent (Art. 7(3) DSGVO): the footer shows a "Cookie-Einstellungen" button (only when ads are enabled) that re-opens Google's dialog via `googlefc.showRevocationMessage`.

Umami stays exactly as in ADR-0016 — cookieless, no consent needed, unaffected by the CMP. Only AdSense sits behind consent.

The Datenschutzerklärung gains an AdSense section (consent-based, TCF, revocable), a recipients/third-country section, and a Lernfortschritt/Profil section it had been missing; § 25 TTDSG was corrected to TDDDG (renamed in 2024).

## Consequences

- Google's script is loaded on every page, including before consent, because it is what renders the consent message. Google's CMP is designed for this; no ad requests or non-essential storage happen until the visitor consents.
- A static tag can't be switched off per account. Once the ad-free entitlement exists, ad-free accounts would still load Google's script and see the consent message; that needs its own change then (e.g. load the script at runtime after `/auth/me` on logged-in routes and keep the static tag only on public pages).
- Consent wording/design is limited to what Google's tool offers. Revisit (option 2) if a second consent-requiring service appears, e.g. the planned Web Speech API speech-to-text, which in Chromium sends audio to Google's servers and needs its own disclosure.
- Manual steps outside the repo: create the consent message and enable TCF in the AdSense dashboard, submit the site for review, then set `VITE_ADSENSE_CLIENT_ID` on Render.
- The Content-Security-Policy in `render.yaml` is still only `frame-ancestors 'none'`; adding a `script-src`/`connect-src` allowlist would now have to include Google's ad domains. *(See the addendum below.)*

## Addendum (2026-09-20): Content-Security-Policy

The frontend now sends an enforced CSP with the directives that can't break an integration (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`) plus a full allowlist (`script-src`, `connect-src`, `img-src`, `frame-src`, ...) as `Content-Security-Policy-Report-Only`. Google's ad stack loads from many hosts that vary with the ads served, so an enforced allowlist written from documentation alone could silently break ads or the consent dialog; report-only makes the gaps visible in the browser console first. Follow-up, once the live console is clean: move the allowlist into the enforced header. `style-src` keeps `'unsafe-inline'` because the prerendered landing page contains `style=""` attributes.

## Addendum (2026-09-21): `users.ads_removed`

The ad-free entitlement now exists as a flag, set by the operator on `/admin` like the AI check. It only hides the UI's ad elements (`useShowAds()` in `frontend/src/ads.ts`: the "Cookie-Einstellungen" button and any future ad unit). The static script in the `<head>` is unchanged, so ad-free accounts still load Google's script and may see the consent message — the runtime-loading change described above stays open until there are ad units worth suppressing.

## Addendum (2026-09-22): CSP moved from report-only to enforced

Checked the browser console on sks-lotse.de (landing, imprint, privacy, and opening "Cookie-Einstellungen" to trigger the consent script): the only `[Report Only]` violation was `connect-src` missing `https://gateway.umami.is` — the Umami Cloud SDK loads its script from `cloud.umami.is` but sends tracked events to a separate `gateway.umami.is` endpoint. Added that host and promoted the full allowlist from `Content-Security-Policy-Report-Only` into the enforced `Content-Security-Policy` header in `render.yaml`; the report-only header is gone, there's now a single enforced policy.

## Addendum (2026-09-23): script only where ads are shown, never on /admin

The static tag used to be in every served page, including `app.html`, the shell of `/login` and every logged-in route. There it ran for accounts that had removed ads, and on the admin tools. The script runs as same-origin JavaScript, and the API accepts `sks-lotse.de` with credentials. So any compromise or malvertising along the ad chain could call the API with the session cookie, and on an operator's session that includes exporting and deleting accounts.

Ads stay for every logged-in account that hasn't removed them (a stricter "public pages only" variant was considered and rejected: logged-in learners are the audience). The script is now kept out of exactly two places:

- `scripts/prerender.mjs` strips the static tag from `app.html`; the build fails if any trace remains. The four prerendered public pages keep it, as AdSense's site verification requires.
- `routes/AdScriptGate.tsx` wraps `/login` and the logged-in routes. Once the session check has settled, it loads the script at runtime where `wantsAdScript()` (`src/ads.ts`) says so: ads shown (`useShowAds()`) and not `/admin`. A script that can't be unloaded is left by one full load of the same URL, which Render serves as the script-free shell. This applies to an ads-removed account arriving from a public page, and to navigating into `/admin`. A one-shot `sessionStorage` marker stops a loop, and only when the document was served with the static tag (a misconfigured rewrite); a script the gate injected itself is always left.
- "Cookie-Einstellungen" keeps working everywhere (Art. 7(3) DSGVO). Where the page has no consent API, it opens `/privacy?cookie-einstellungen`, which queues Google's revocation dialog on arrival.

Accepted risk: for accounts that see ads, the script still runs next to their session, including on `/login` while the code is typed. That's the price of in-app ads, and it's bounded by the account's own rights. Ads-removed accounts now get what they pay for: no Google script while using the app.

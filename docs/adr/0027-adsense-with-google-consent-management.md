# 0027. Google AdSense behind Google's own consent management

Status: Accepted (partially supersedes the "no consent banner" consequence of [ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md))

## Context

Monetization ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) includes ads for accounts that haven't paid to remove them, and AdSense is the chosen network. AdSense stores and reads cookies and shares IP/device data with Google, so § 25 TDDDG and Art. 6(1)(a) DSGVO require prior consent; for EU/EEA visitors Google additionally requires a Google-certified CMP implementing the IAB TCF. ADR-0016 explicitly deferred this: "if a future feature needs [a banner] (e.g. Google AdSense), that's its own decision at that point".

Options considered:
1. **Google's own consent management** (AdSense → Privacy & messaging) — free, TCF-certified, no third-party vendor, configured in the AdSense dashboard and delivered by the AdSense script itself.
2. **Third-party CMP** (Cookiebot, Usercentrics, Klaro with TCF, …) — more control over wording/design and consent for non-Google services, but another processor, paid beyond a traffic threshold, and one more script to load and keep TCF-compliant.
3. **Self-built banner** — not accepted by Google for AdSense in the EEA (needs a certified CMP), so a non-starter.

## Decision

**Option 1.** `frontend/src/ads.ts` (`initAds()`, called from `main.tsx`) loads the AdSense script only when `VITE_ADSENSE_CLIENT_ID` is set — unset in local dev/CI, set in production via a Render `sync: false` variable, the same gating and reasoning as `VITE_UMAMI_WEBSITE_ID`. The consent message is created in the AdSense dashboard; the script shows it and withholds personalised ads until the visitor has chosen.

Withdrawal must be as easy as consent (Art. 7(3) DSGVO): the footer shows a "Cookie-Einstellungen" button (only when ads are enabled) that re-opens Google's dialog via `googlefc.showRevocationMessage`.

Umami stays exactly as in ADR-0016 — cookieless, no consent needed, unaffected by the CMP. Only AdSense sits behind consent.

The Datenschutzerklärung gains an AdSense section (consent-based, TCF, revocable), a recipients/third-country section, and a Lernfortschritt/Profil section it had been missing; § 25 TTDSG was corrected to TDDDG (renamed in 2024).

## Consequences

- Google's script is loaded on every page, including before consent, because it is what renders the consent message. Google's CMP is designed for this; no ad requests or non-essential storage happen until the visitor consents.
- Ad-free accounts must not load the script at all once the entitlement exists — `initAds()` will need to be gated on the account, not just the env var. Until then every account sees the consent message. Tracked as a follow-up together with the entitlement work.
- Consent wording/design is limited to what Google's tool offers. Revisit (option 2) if a second consent-requiring service appears, e.g. the planned Web Speech API speech-to-text, which in Chromium sends audio to Google's servers and needs its own disclosure.
- Manual steps outside the repo: create the consent message and enable TCF in the AdSense dashboard, add `ads.txt` (needs the publisher id, so it isn't committed here), submit the site for review, then set `VITE_ADSENSE_CLIENT_ID` on Render.
- The Content-Security-Policy in `render.yaml` is still only `frame-ancestors 'none'`; adding a `script-src`/`connect-src` allowlist would now have to include Google's ad domains.

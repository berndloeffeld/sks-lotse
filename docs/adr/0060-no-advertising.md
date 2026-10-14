# 0060. No advertising

Status: Accepted — supersedes [ADR-0027](0027-adsense-with-google-consent-management.md); amends [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md), [ADR-0043](0043-token-based-ai-grading-monetization.md) and [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md) (no "Werbefrei" add-on); restores the "no consent banner" consequence of [ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md). Addenda of 2026-10-14 to [ADR-0047](0047-totp-step-up-for-admin-area.md), [ADR-0054](0054-learning-by-topic-open-without-login.md) and [ADR-0056](0056-chart-exercises-open-to-guests.md) note that the ad script they describe is gone.

## Context

[ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md) planned SKS Lotse as freemium with two add-ons: remove ads, and the AI answer check. [ADR-0027](0027-adsense-with-google-consent-management.md) chose Google AdSense behind Google's own consent dialog, and its addenda built everything around it: the AdSense script on the public pages for the site review, a runtime gate (`AdScriptGate`) for the app, a "Cookies" footer button to withdraw consent, `ads.txt`, a CSP allowlist for Google's ad hosts, the `users.ads_removed` flag with its price in `app_settings`, and an AdSense section in the Datenschutzerklärung. No ad unit was ever rendered, and "Werbefrei" was never on sale.

Ads were never possible in practice: AdSense's site review keeps rejecting sks-lotse.de as "low value content". Without an approved site there are no ad units, so all of the above ran for nothing. It still cost something: Google's script on the public pages, Google receiving every visitor's IP address before any choice, a consent dialog to keep working, CSP exceptions for Google's hosts and a "Werbefrei" add-on that couldn't be sold.

The operator has therefore decided the site will carry no advertising. The AI check, paid with tokens ([ADR-0043](0043-token-based-ai-grading-monetization.md), [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md)), is the only source of revenue.

## Decision

Remove all of it: the ad script and its gate, the consent button and dialog handling, `ads.txt`, the build variables `VITE_ADSENSE_CLIENT_ID` and `VITE_AD_UNITS`, Google's ad hosts in the CSP, the "Werbefrei" add-on (flag, price, admin toggle, the API fields `ads_removed`, `ads_removed_price_cents` and `price_ads_removed_cents`) and the ad passages in the Datenschutzerklärung and the AGB. The AGB change is material (Ziffer 4 now names one add-on), so the AGB version moves on and every account confirms again.

The column `users.ads_removed` is dropped in a follow-up migration (`c5e8a1f3b927_drop_ads_removed.py`, together with the stored price), not in the same change: the backend that is still running while `preDeployCommand` migrates reads every mapped column of `users`, so dropping it then would fail its queries until the new version serves (CLAUDE.md → Deployment). Purchases rows with `product = "ads_removed"`, if any, stay in the ledger as bookkeeping records.

## Consequences

- No third-party script but Umami runs on the site, and Umami needs no consent ([ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md)). There is no consent banner and no consent dialog to maintain.
- The CSP shrinks to the own origin, the API and Umami; frames and images from other origins are refused.
- The admin user update takes only token grants and debits. An admin page from before this change that still sends `ads_removed` gets a 422 until it reloads.
- Manual steps outside the repo: remove the variables' values on Render's static site, remove the site from AdSense and switch off its consent message, archive a "Werbefrei" product in Stripe if one exists.
- Bringing ads back would be a new decision, starting from consent again; [ADR-0027](0027-adsense-with-google-consent-management.md) and its addenda record what that took.

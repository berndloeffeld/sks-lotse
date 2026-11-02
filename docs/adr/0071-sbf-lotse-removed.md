# 0071. SBF Lotse removed again

Status: Accepted — supersedes [ADR-0067](0067-second-site-from-one-codebase.md), [ADR-0068](0068-sbf-navigation-tasks-from-reviewed-yaml.md), [ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) and [ADR-0070](0070-sbf-api-host-and-site-per-request.md); withdraws their amendments of [ADR-0012](0012-httponly-cookie-for-frontend-session-token.md), [ADR-0015](0015-frontend-deployment-topology.md), [ADR-0025](0025-build-time-prerender-of-the-landing-page.md) and [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md)

## Context

[ADR-0067](0067-second-site-from-one-codebase.md) built a second site from this codebase, SBF Lotse on sbf-lotse.de. [ADR-0068](0068-sbf-navigation-tasks-from-reviewed-yaml.md) gave it the 15 Navigationsaufgaben See for guests, [ADR-0069](0069-frontend-split-and-sbf-api-through-a-proxy.md) split the frontend into `src/shared/`, `src/sks/` and `src/sbf/`, and [ADR-0070](0070-sbf-api-host-and-site-per-request.md) prepared accounts on it: a second API host, api.sbf-lotse.de, and a site per request in the backend. The accounts never went live (`VITE_SBF_ACCOUNTS=off`), so no learner has an SBF account, a purchase on SBF Lotse or a session on api.sbf-lotse.de.

Carrying two sites costs on every change: a second build in CI, the site switch in the shell, the legal texts and the mails, the import boundary between the directories, the load and the login mails of a second audience. On 2026-11-02 the operator decided to give SBF Lotse up and keep SKS Lotse alone.

## Decision

**SBF Lotse is removed from the code, the configuration and the documentation.**
- Frontend: `src/sbf/`, `index.sbf.html`, `public-sbf/`, `scripts/check-sbf-build.mjs`, the site identity (`site.ts`, `siteConfig.ts`, `sbfFlag.ts`) and the env vars `VITE_SITE`, `VITE_SBF` and `VITE_SBF_ACCOUNTS`. `src/shared/` is merged back into `src/sks/`, and with it the lint rule that kept the directories apart. `src/sks/site.ts` keeps only the brand's name and origin.
- Backend: the site per request (`app/core/site.py`), `EMAIL_FROM_ADDRESS_SBF`, the SBF origins in CORS, the per-site numbers of the daily report and the admin views, and the Navigationsaufgaben with their YAML, scripts, tests and PDF.
- `render.yaml`: the service `sbf-lotse-frontend` and its CI builds.
- Legal texts: the Impressum, the Datenschutzerklärung and the AGB name SKS Lotse only.

**The two site columns go in two steps**, since a migration runs while the previous version still serves ([docs/RUNBOOK.md](../RUNBOOK.md)):
1. This change stops mapping `users.signup_site` and `purchases.site`. They stay in the database, and `alembic/env.py` keeps `alembic check` from reporting them.
2. A follow-up migration drops them and removes that exception.

**Outside the repo**, by hand: delete the Render service `sbf-lotse-frontend` and the custom domain api.sbf-lotse.de of `sks-lotse-backend`, the DNS records at IONOS, and the sending domain sbf-lotse.de at Resend (docs/RUNBOOK.md → Decommissioning SBF Lotse).

## Consequences

- One build, one site, one origin: the shell, the mails and Stripe's return URLs no longer ask which site they're on.
- Git history keeps all of it. A second site later would start from the commits of ADR-0067 to ADR-0070, not from scratch.
- The AGB version stays at 2026-10-24: the change only takes the second website out of its scope, nothing a learner has to agree to anew.
- What SKS Lotse says about the SBF See stays: it's the prerequisite of the SKS (Prüfungsablauf, FAQ). Only the link to SBF Lotse goes.
- Rejected: leaving the code in place behind `VITE_SITE`. Without a site to build it is dead code that every change still has to keep compiling and passing its tests.

# 0055. Prerendered pages as directory index files, no rewrite per page

Status: Superseded by [ADR-0057](0057-prerendered-pages-as-flat-files-with-a-rewrite-each.md): Render answers `/faq` with an empty body when the file is `faq/index.html`. Had amended [ADR-0025](0025-build-time-prerender-of-the-landing-page.md) and [ADR-0054](0054-learning-by-topic-open-without-login.md) (pages as directory index files).

## Context

The prerender wrote each public page as `dist/<path>.html` (`faq.html`, `learn/navigation/seekarten.html`). Render doesn't map `/faq` to `faq.html` on its own: on production, `/index` gets the `app.html` fallback, not `index.html`. So `render.yaml` rewrote every page's path to its file, ahead of the `/* → /app.html` fallback.

When PR #235 shipped `/learn` and its topic pages, `/learn` and every topic page answered `200` with an empty body for several minutes, logged-in learners included, since `/learn` is their start page. Render applies a Blueprint's routes on the sync, right after the push. The static site's build only deploys once the checks on `main` have passed (`autoDeployTrigger: checksPass`). Until then, the new rewrites pointed at files that didn't exist yet, and Render answers such a rewrite with an empty body. Cloudflare cached those empty answers too.

Any rewrite to a file that the same change creates has this gap. A rule in the runbook ("add the rewrite only after the file is deployed") would make every new page a two-PR change, and the gap would come back the first time someone forgets.

## Decision

- Each prerendered page is written as its path's **directory index**: `dist/faq/index.html`, `dist/learn/index.html`, `dist/learn/navigation/seekarten/index.html`. `/` stays `dist/index.html`. The file name comes from `page()` in `frontend/src/publicPages.ts`.
- Render serves a directory's `index.html` for both `/faq` and `/faq/`, without a redirect, and treats it as an existing resource, so no rewrite applies. `/` already relied on this ahead of the catch-all.
- `render.yaml` has **one rewrite only**, the SPA fallback `/* → /app.html`, plus the redirects of retired paths. `backend/tests/test_catalog_export.py` fails if any other rewrite appears.

## Consequences

- No route ever points at a file a deploy still has to create. A page that isn't deployed yet falls through to `app.html`, and the SPA renders it on the client: no prerendered markup for those minutes, but never empty.
- A new public page or catalog topic needs no change to `render.yaml`. The page list in `publicPages.ts` is the only place.
- `/faq/` serves the same page as `/faq`. The canonical tag names the slash-less URL, and `main.tsx` already ignores a trailing slash when it decides whether to hydrate.
- Render documents the "no rule where a file exists" precedence, but not the directory-index lookup. It is verified on production after the deploy (`curl` each page, look for `data-prerendered`). If Render ever stopped resolving directory index files, the pages would fall back to the SPA. They would stay usable, just not prerendered.
- **Rejected**: a runbook rule to add rewrites one deploy after their files (manual, two PRs per page, easy to forget). `autoDeployTrigger: commit` for the static site (only shortens the gap to the build time, and gives up the green-checks gate). Turning off the Blueprint's auto-sync (routes would then wait for a manual sync, the same race the other way round).

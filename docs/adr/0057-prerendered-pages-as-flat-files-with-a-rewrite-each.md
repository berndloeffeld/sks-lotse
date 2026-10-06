# 0057. Prerendered pages as flat files with a rewrite each

Status: Accepted — supersedes [ADR-0055](0055-prerendered-pages-as-directory-index-files.md): Render does not serve a directory index for a path without a trailing slash. Amends [ADR-0054](0054-learning-by-topic-open-without-login.md) (each page keeps its rewrite in `render.yaml`).

## Context

[ADR-0055](0055-prerendered-pages-as-directory-index-files.md) wrote each prerendered page as its path's directory index (`dist/faq/index.html`). It assumed that Render serves that file for `/faq` too, as it does for `/`, so `render.yaml` would need no rewrite per page. The assumption was marked as unverified and was checked on production after the deploy. It doesn't hold. Measured with `curl`, cache-busted, CDN `MISS`:

| Path | Answer |
|---|---|
| `/faq`, `/terms`, `/pricing`, `/exam-process`, `/learn`, `/learn/navigation/seekarten` | `200`, empty body |
| `/faq/` | `200`, the prerendered page |
| `/learn/navigation` (a directory without `index.html`) | `200`, `app.html` via the SPA fallback |

Render treats `/faq` as an existing resource because the directory `faq/` exists. So the `/* → /app.html` rewrite doesn't apply, and Render answers with an empty body. Inside the SPA every page worked. A direct load or a reload of any prerendered page except `/` showed a white page, `/learn` included, which is the logged-in learners' start page.

## Decision

- Back to the layout from before ADR-0055: each page is a **flat file** `dist/<path>.html` (`faq.html`, `learn/navigation/seekarten.html`), and `render.yaml` **rewrites each path to its file**, ahead of the SPA fallback. `page()` in `frontend/src/publicPages.ts` names the file.
- `backend/tests/test_catalog_export.py` checks that the rewrites match the pages: the static pages, `/learn` and every topic page, each `→ <path>.html`. It also checks that `/charts` and `/charts/<n>` have rewrites exactly while `VITE_CHART_EXERCISES` is `on`, since only then are their files built ([ADR-0056](0056-chart-exercises-open-to-guests.md)). The fallback stays last.

## Consequences

- Every prerendered page loads directly again. `/faq/` with a slash gets the SPA shell, which renders the page on the client.
- **The gap ADR-0055 tried to close is back.** Routes go live on the Blueprint sync, before the build that writes the file. A rewrite for a page the same PR adds answers `200` with an empty body until that deploy is live, a few minutes after the merge. The test above makes the rewrite ship with its page, so this gap is accepted. New pages are rare: a catalog topic only comes with a catalog import, and `/charts` when the flag goes `on` once. Pages that already exist are never affected.
- Lesson recorded: a Render routing behaviour that the docs don't describe is verified on a deploy that doesn't break production if it's wrong, before the layout depends on it.

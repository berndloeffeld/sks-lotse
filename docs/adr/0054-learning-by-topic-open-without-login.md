# 54. "Lernen nach Thema" open without a login, prerendered from a committed catalog export

Status: Accepted — amends [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md) (login no longer required to read and practise the catalog) and [ADR-0025](0025-build-time-prerender-of-the-landing-page.md) (the /learn pages are prerendered too). Amended by [ADR-0055](0055-prerendered-pages-as-directory-index-files.md): no rewrite per page in `render.yaml`. Amended by [ADR-0056](0056-chart-exercises-open-to-guests.md): the Kartenaufgaben are open to guests too while their flag is `on`.

## Context

Everything but the landing and legal pages sat behind the login ([ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)). Search engines therefore saw none of the catalog, though the catalog is what people search for ("SKS Fragen Navigation", a question's wording). SEO feedback asked to make the questions and answers reachable without a login. The official catalog is an amtliches Werk (no copyright, cite ELWIS, wording unchanged), so publishing it is allowed.

What the operator asked for: open "Lernen nach Thema" as logged-in learners know it, minus what needs an account. Options considered:

1. **A separate public reading archive** (`/questions/...`): a second presentation of the same questions next to the app.
2. **The existing `/learn` pages in a guest mode**: same URLs and the same run, without grading, Lernstand, Fokus, Auffrischen, Probeprüfung, Lotsen-Check and question reports.

And for where the guests' data comes from:

1. **A public API endpoint** (`GET /api/v1/catalog`): a new unauthenticated route (rate limit, load on the one uvicorn worker), and the build would still need the data separately to prerender.
2. **A committed export** of the catalog, generated from the same sources the catalog data migrations sync.

## Decision

- **Guest mode on the existing pages** (option 2): `/learn` (every topic, both Seemannschaft variants, since a guest has no exam variant) and `/learn/:subject/:topic` (the run) are open. A guest reads the question, writes an answer, reveals the official answer and grades themselves, in catalog order, and gets the round's summary at the end. **Nothing is saved**: the gradings only count for that summary and are gone with the page; nothing is sent, and it is no Lernstand (no half-life, no "gelernt"). Keeping them in the browser was considered and dropped: a "last time" figure that is there in one browser and not in another raises more questions (when is it kept, when not) than it answers. The parts that need an account (Lotsen-Check, question reports, the gauge) are left out or shown as a pointer to the login. Fokus, Auffrischen, the Probeprüfung, the profile and everything else stay behind the login. The rule "no anonymous progress" stands.
- **Below every topic's run, all its questions with their official answers**, each folded shut (`<details>`), for guests and learners alike. The HTML carries the whole topic for search engines while the answer stays hidden until opened.
- **Data from a committed export** (option 2): `backend/scripts/export_catalog.py` writes `frontend/src/data/catalog.gen.json` from `build_catalog()` (PDF + reviewed YAML, no database). `backend/tests/test_catalog_export.py` fails while the committed file is stale, in the required `backend-test` job. The client loads it as its own chunk, only for guests and prerendered pages. Logged-in learners keep loading questions from the API, which carries the question ids progress is stored under. **No new open API route.**
- **Prerendered**: `/learn` and one page per topic, each with its own title, description and canonical, listed in the generated `sitemap.xml`. The list lives in `frontend/src/publicPages.ts` and is shared by the prerender and the sitemap. Every page has an explicit rewrite in `render.yaml`, and the backend test checks that every topic of the export has one. Text taken from data into the head is HTML-escaped. The pages are built **without the static ad script**, because logged-in learners, including ads-removed accounts, land on them. `AdScriptGate` loads it at runtime where ads are wanted, as on every other app route.
- A logged-in learner who opens such a page directly sees the guest's version until the session check returns, then their own (as on the landing page).

## Consequences

- The catalog is indexable and usable without an account. The account is still what makes the learning remember anything, which is the reason to sign up.
- A guest's run is in catalog order, not shuffled: the prerendered HTML and the client's first render must match, and a fixed order is also what a reader who arrives from a search expects.
- A catalog change now has one more generated file to commit (re-run `export_catalog.py`), enforced by the test. A new or renamed topic also needs its rewrite in `render.yaml`, enforced by the same test.
- Guests cause no API traffic beyond the session check every page already makes. The load stays on the static site and its CDN.
- **Rejected**: the separate archive (a second UI for the same content, and the app's own pages would stay invisible). The public API (an open route and a second data path for the build). Per-question pages (540 thin pages, and `seemannschaft_allgemein`'s numbers are derived and can shift, so the URLs wouldn't be stable). Topic pages with their anchors (`#frage-29`) cover the same searches.

# 0059. A data router, on the client and in the prerender, so a guest's run can ask before it is left

Status: Accepted — amends [ADR-0025](0025-build-time-prerender-of-the-landing-page.md) (the prerender renders under a memory data router, not a `StaticRouter`).

## Context

A guest works through a Kartenaufgabe in the page only. Nothing is saved ([ADR-0056](0056-chart-exercises-open-to-guests.md)). A sheet has up to 18 tasks, and the Back gesture, the logo or a header link threw that work away without a word. The browser's own `beforeunload` prompt covers closing and reloading the tab, but not a navigation inside the SPA. React Router's answer for that is `useBlocker`: it holds a link, a `navigate()` or Back/Forward until the page lets it go. `useBlocker` only works under a **data router** (`createBrowserRouter` + `RouterProvider`). The app ran under the declarative `<BrowserRouter>`, and the build-time prerender ([ADR-0025](0025-build-time-prerender-of-the-landing-page.md)) under a `<StaticRouter>`.

Switching the client alone would quietly break hydration. `RouterProvider` renders its providers as a fragment with a `null` sibling, `StaticRouter` doesn't. React derives `useId` values from the tree's shape, so ids from the prerendered HTML would no longer match the client's. No prerendered page uses `useId` today, but the first one would hydrate with mismatched `id`/`aria-*` pairs.

Options considered:
- **`createStaticHandler` + `StaticRouterProvider`** for the prerender, React Router's own SSR path. It is asynchronous (`query()` returns a promise), so `render()` and `scripts/prerender.mjs` would become async. It also renders a different tree from the client's `RouterProvider` unless configured exactly alike. That is more change for a prerender with no loaders.
- **A hand-made block**: wrap `history.push`, re-push on `popstate`. It is fragile, depends on React Router internals, and every link would need to know about it.
- **Only `beforeunload`**, without blocking in-app navigation. It misses the case that was reported: Back and header links.

## Decision

- The app is **one route of a data router**: `appRoutes = [{ path: '*', element: <AppRoutes /> }]` (`frontend/src/appRoutes.tsx`). The routes themselves stay the declarative `<Routes>` in `AppRoutes`; descendant routes under `*` are supported in a data router.
- **Client**: `createBrowserRouter(appRoutes)` + `<RouterProvider>` (`main.tsx`).
- **Prerender**: `createMemoryRouter(appRoutes, { initialEntries: [url] })` + the same `<RouterProvider>` (`entry-server.tsx`). That is the same tree as the client's, so hydration matches, `useId` included. No route has a loader, so the memory router is ready at once and `render()` stays synchronous. `RouterProvider` only touches `window` in effects, so it renders in Node.
- `src/hooks/useLeaveConfirmation.ts` combines `beforeunload` with `useBlocker`. `GuestChartRun` uses it while the run has answers and isn't complete, and shows "Durchgang verwerfen?" for a blocked navigation.
- `src/entry-server.test.tsx` hydrates prerendered pages under the client's router and fails on any hydration error.

## Consequences

- `useBlocker` (and React Router's other data-router hooks) can be used anywhere in the app.
- A test that renders a component calling `useBlocker` needs `createMemoryRouter` + `RouterProvider`. A plain `MemoryRouter` throws there. The other tests keep their `MemoryRouter`.
- Loaders, actions and route-level error elements stay unused. Descendant `<Routes>` can't have them. Moving the routes into route objects would be the step if they are ever wanted.
- Only one blocker can be active at a time (React Router's limit), which is fine for one guest run per page.

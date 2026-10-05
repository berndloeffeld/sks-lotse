# SKS Lotse — frontend

React (Vite) + TypeScript, per [ADR-0013](../docs/adr/0013-frontend-architecture-and-tooling.md); visual design per [ADR-0014](../docs/adr/0014-visual-design-system.md). Setup, quality gates and conventions for the whole repo are in the root [README.md](../README.md) and `CLAUDE.md`; the frontend's structure is in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) → Frontend.

## Local dev

```bash
npm install
cp .env.example .env   # points VITE_API_BASE_URL at a local backend on :8000
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check (`tsc -b`), client + SSR build, then `scripts/prerender.mjs` (every public page of `src/publicPages.ts`: the static pages, one per catalog topic and one per Kartenaufgaben sheet, and the `app.html` shell); CI runs it too
- `npm run lint` / `npm run format` / `npm run format:check` — ESLint / Prettier
- `npm run test` — Vitest once; `npm run test:watch` for watch mode; add `-- --coverage` for the coverage report and its gate (thresholds: `test.coverage.thresholds` in [`vite.config.ts`](vite.config.ts))
- `../scripts/run_frontend_mutation_tests.sh gate` — Stryker over the logic modules (minimum score in the script, [docs/mutation-testing.md](../docs/mutation-testing.md))

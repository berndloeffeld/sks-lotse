# SKS Lotse — frontend

React (Vite) + TypeScript, per [ADR-0013](../docs/adr/0013-frontend-architecture-and-tooling.md); visual design per [ADR-0014](../docs/adr/0014-visual-design-system.md). See the repo root `CLAUDE.md` for the full project context.

## Local dev

```bash
npm install
cp .env.example .env   # points VITE_API_BASE_URL at a local backend on :8000
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check (`tsc -b`) + production build
- `npm run lint` / `npm run format` / `npm run format:check` — ESLint / Prettier
- `npm run test` — Vitest once; `npm run test:watch` for watch mode; add `-- --coverage` for the coverage report (90% lines / 85% branches gate)

# Mutation testing

Coverage says which lines the tests *run*; mutation testing says whether they would *notice a bug*.
The tool changes the code one small step at a time (`>=` → `>`, `and` → `or`, a constant, a dropped
line — a "mutant") and re-runs the tests. A mutant a test fails on is **killed**; one that still
passes **survived**, i.e. the tests don't pin that behavior down. Mutation score = killed / all.

**It runs daily** (03:00 UTC, `.github/workflows/mutation-testing.yml`, also startable by hand from the
Actions tab), not on every PR, so it never holds up merges. A CI run takes about 30 minutes for the backend job
(timeout 45) and about 25–30 for the frontend job (timeout 60), whose 4-vCPU runner Stryker splits into two
TypeScript-checker and two test-runner processes — locally it takes a few minutes. Those are the only runtimes this page states. A job that
runs into its timeout ends as `cancelled`, and the alert job treats every result but `success` as a failed run. A failed run opens an issue
("Mutation testing failed"); a regression therefore surfaces up to a day after the change that caused it. Each job fails if fewer than
`MUTATION_MIN_SCORE` of the mutants are killed (`scripts/run_mutation_tests.sh`, `scripts/run_frontend_mutation_tests.sh`).
The rules for that minimum (a ratchet) and for keeping the scope current: [`CLAUDE.md`](../CLAUDE.md#mutation-testing).
100% is neither reachable (equivalent mutants) nor the goal; the check is there to catch regressions. Two limits to keep in
mind: an aggregate score over a few thousand mutants barely moves for a small new function (50 surviving mutants ≈ 1.5 points),
so when you add logic, look at the survivor list the job prints, not just at pass/fail; and the run is ±1–2
mutants noisy (timing-dependent rate-limit tests), which the margin absorbs.

A failing job prints the surviving mutants. Work them like this: `./scripts/run_mutation_tests.sh show <name>`
shows the change, then add the test that would fail on it — or, if the change has no observable effect, leave it.

## Backend (mutmut)

```bash
cd backend && .venv/bin/pip install -r requirements-mutation.txt   # once
./scripts/run_mutation_tests.sh                                     # lists the survivors
./scripts/run_mutation_tests.sh gate                                # what CI runs: fails below the minimum score
./scripts/run_mutation_tests.sh show app.domain.progress.x_is_learned__mutmut_2
```

- **Score (2026-10-06, local run): 4458 of 4872 mutants killed (91.5%)**. Minimum in CI: **89%**.
- **Scope**: exactly `only_mutate` in `[tool.mutmut]` of [`backend/pyproject.toml`](../backend/pyproject.toml), the
  single list; the modules deliberately left out, each with its reason, are the `EXCLUDED` set in
  [`backend/tests/test_mutation_scope.py`](../backend/tests/test_mutation_scope.py) (which is ignored inside mutmut's own
  runs, since the handlers mode rewrites `only_mutate`). In short: the product rules in
  `domain/`, the logic in `core/` and `services/`, and the undecorated helpers in `api/v1/`; not the catalog importer
  and `scripts/` (their tests read the PDF, which `mutants/` doesn't have), nor config, wiring, models and schemas.
- **mutmut skips decorated functions**, i.e. every FastAPI route handler, so the normal run never mutates their bodies.
  `./scripts/run_mutation_tests.sh handlers` does: it mutates a throw-away copy of `backend/` in which each decorator is
  moved behind its function (`backend/scripts/mutation_handlers_setup.py`; the repo isn't touched), scoped to
  `app/api/v1/`. Most of its survivors are message wording (`detail=`), rate-limit bucket *names*
  (`'ai_grade:user'` → `None`; harmless as long as the keys differ) and SQL shape (`order_by`, join conditions SQLAlchemy
  infers anyway). The real ones — statistics, the DSGVO export, per-user limit keys, the hourly code quota — are tested.
- **What survives is judged, not chased.** The remaining ones are equivalent or not worth a test: `>` vs `>=` on
  timestamps that never compare equal, log and exception message wording, the text of the KPI report and e-mails
  (`kpis.format_report` alone is ~33 of the survivors; the login-code mails likewise), `86401` vs `86400`, `partition` vs
  `rpartition` on validated single-`@` addresses, `call_next(None)` (Starlette ignores the argument), renamed throttle/log
  keys, `XXXX` as an unused default, the HMAC label of the OTP key (a pure constant), `populate_existing` in
  `services/user.locked_user` (needs a stale-session race to observe), and three time-zone mutants
  (`astimezone(None)`, the case of `"Europe/Berlin"`) that only differ on a machine that isn't in Berlin time or has a
  case-sensitive file system — a local run understates the CI score there. A new survivor in a module not on this list
  deserves a look.
- The two test files that read files outside `backend/` (`test_catalog_seed.py`,
  `test_integration_collection.py`) are ignored in the mutation run; they cover none of the scoped modules.

## Frontend (Stryker)

```bash
cd frontend && npm ci                                   # once
./scripts/run_frontend_mutation_tests.sh                # clear-text survivors + HTML report in frontend/reports/mutation/
./scripts/run_frontend_mutation_tests.sh gate           # what CI runs: fails below the minimum score
```

- **Score (2026-10-06, local run): 703 of 744 counted mutants killed (94.5%)**. Minimum in CI: **91%**.
- **Scope**: exactly `mutate` in [`frontend/stryker.config.json`](../frontend/stryker.config.json), the logic modules
  (the `.ts` files directly in `src/sks/` and in its `api/`, `store/`, `hooks/`); the ones left out are the `EXCLUDED` set in
  `src/test/mutationScope.test.ts`, which keeps the list current. Components and pages are deliberately out for now: their mutants are
  mostly markup and class names, and only page-level tests cover them, which makes runs slow and survivors noisy.
- **Setup**: `@stryker-mutator/core` + `vitest-runner` + `typescript-checker` (exact versions), `coverageAnalysis: perTest`
  (each mutant only runs the tests that cover it, ~12 per mutant). The TypeScript checker drops mutants that don't compile
  (≈60 of ~300) instead of counting them as survivors.
- **`ignoreStatic: true`**: a mutant in module-level code (the page list, constants) is "static", i.e. it
  changes what runs at import time, so Stryker re-runs the *whole* suite for it. Those mutants took most of the time and
  pushed the job into its timeout, so they are ignored (not counted); that also takes mostly-*killed* mutants out of the
  score. The SEO wording of the prerendered pages lives in `src/sks/publicPageTexts.ts`, which is not mutated (a changed
  sentence is no bug); the logic of `publicPages.ts` is. Module-level setup that is still mutated (the client's verbs and
  constants, the auth store, `EVENT_ORDINALS`) is only seen by a test that imports the module afresh
  (`vi.resetModules()` + `await import(...)`).
- **Remaining survivors are equivalent:** `body === undefined ? undefined : JSON.stringify(body)` → `JSON.stringify(body)`
  (`JSON.stringify(undefined)` is `undefined` anyway), `.catch(() => null)` vs `() => undefined`, the `?? ''` default of
  `VITE_API_BASE_URL` (a build-time config), the countdown's initial state (overwritten by the immediate tick), the cache
  keys of `useApiQuery` (a different key changes nothing as long as keys don't collide), and the dependency arrays of
  `useCallback`/`useEffect` (e.g. in `useProgressSummary`: the callbacks are stable; a wrong array needs a re-render race
  to observe).
- **The gate refuses a broken runner.** `@stryker-mutator/vitest-runner` 10.0.0 doesn't work with Vitest 5: it filters
  tests by name with a space-joined path, Vitest 5 joins with ` > `, so no test runs and *every* mutant "survives"
  ([stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)), while Stryker still exits 0. Hence Vitest
  and `@vitest/coverage-v8` are pinned to 4.1.11 ([ADR-0035](adr/0035-vitest-pinned-to-4x-for-stryker.md)), Dependabot ignores
  their major bumps, and `gate` fails when a surviving mutant ran zero tests. Symptoms of the broken runner: a score under
  ~20% and "Ran 0.00 tests per mutant on average" — that means the runner, not the tests.

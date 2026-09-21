# Mutation testing

Coverage says which lines the tests *run*; mutation testing says whether they would *notice a bug*.
The tool changes the code one small step at a time (`>=` → `>`, `and` → `or`, a constant, a dropped
line — a "mutant") and re-runs the tests. A mutant a test fails on is **killed**; one that still
passes **survived**, i.e. the tests don't pin that behavior down. Mutation score = killed / all.

It is a periodic check, deliberately not a CI gate: a run is minutes to hours, and equivalent
mutants (a change with no observable effect) mean 100% is neither reachable nor the goal.
The trend and the individual survivors are what matter.

## Backend (mutmut)

```bash
cd backend && .venv/bin/pip install -r requirements-mutation.txt   # once
./scripts/run_mutation_tests.sh                                     # ~30 s
./scripts/run_mutation_tests.sh show app.core.progress.x_is_learned__mutmut_2
```

- **Scope** (`[tool.mutmut]` in `backend/pyproject.toml`): the pure logic modules — `core/progress`,
  `exam`, `exam_variant`, `email_address`, `cache`, `rate_limit`, `otp`, `services/ai_quota`. Wiring,
  config and the catalog importer would only add noise. Widen `only_mutate` to grow the scope.
- **First run (2026-09-21): about 360 of 407 mutants killed (88%)**, 46–47 survivors (varies by one between runs: timing-dependent rate-limit tests) — mostly in `rate_limit`
  (sweep/`_client_ip` details), `progress` (the `learned_clause`/`learning_clause` SQL filters) and
  `email_address`/`otp` edge cases. Worth working through: a survivor is either a missing test or
  dead/redundant code.
- The two test files that read files outside `backend/` (`test_catalog_seed.py`,
  `test_integration_collection.py`) are ignored in the mutation run; they cover none of the scoped modules.

## Frontend (Stryker) — not set up yet

`@stryker-mutator/vitest-runner` 10.0.0 doesn't work with Vitest 5: it filters tests by name with a
space-joined path, Vitest 5 joins with ` > `, so no test runs and *every* mutant "survives"
([stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)). This project is on
Vitest 5.0.1. Once the runner is fixed (or if the project pins Vitest 4 in the meantime), install
`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`, scope `mutate` to the logic files
(`src/format.ts`, `ads.ts`, `analytics.ts`, `labels.ts`, `api/client.ts`, `store/authStore.ts`,
`hooks/useExamCountdown.ts`) and check that the score is plausible (a survivor list that includes
`percentOf`'s obvious conditional means the runner is still broken).

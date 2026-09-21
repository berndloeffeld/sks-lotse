# Mutation testing

Coverage says which lines the tests *run*; mutation testing says whether they would *notice a bug*.
The tool changes the code one small step at a time (`>=` → `>`, `and` → `or`, a constant, a dropped
line — a "mutant") and re-runs the tests. A mutant a test fails on is **killed**; one that still
passes **survived**, i.e. the tests don't pin that behavior down. Mutation score = killed / all.

**It is a required CI check** (`mutation-testing` in `backend-ci.yml`): the job fails if fewer than
`MUTATION_MIN_SCORE` (87%, `scripts/run_mutation_tests.sh`) of the mutants are killed. That is a ratchet a few
points under the current score (~89.6%), like the coverage gates: raise it when the score settles higher, never
lower it to get a PR through. 100% is neither reachable (equivalent mutants) nor the goal, and a score
that is optimised for stops measuring anything — the gate is there to catch regressions. Two limits to keep in
mind: an aggregate score over ~1600 mutants barely moves for a small new function (50 surviving mutants ≈ 3 points),
so when you add logic, look at the survivor list the job prints, not just at pass/fail; and the run is ±1–2
mutants noisy (timing-dependent rate-limit tests), which the margin absorbs.

A failing job prints the surviving mutants. Work them like this: `./scripts/run_mutation_tests.sh show <name>`
shows the change, then add the test that would fail on it — or, if the change has no observable effect, leave it.

## Backend (mutmut)

```bash
cd backend && .venv/bin/pip install -r requirements-mutation.txt   # once
./scripts/run_mutation_tests.sh                                     # ~1 min; lists the survivors
./scripts/run_mutation_tests.sh gate                                # what CI runs: fails below the minimum score
./scripts/run_mutation_tests.sh show app.core.progress.x_is_learned__mutmut_2
```

- **Scope** (`[tool.mutmut]` in `backend/pyproject.toml`, `only_mutate`): the pure logic in `core/` (progress, exam,
  exam_variant, email_address, cache, rate_limit, otp), all of `services/` except the catalog importer
  (`ai_quota`, `focus`, `user`, `grader`, `kpis`, `email`) and the helper functions in `api/v1/` (exams, progress,
  auth, questions, admin). Left out on purpose: `catalog_seed.py`/`scripts/` (parse and migration code whose tests read
  the PDF, which `mutants/` doesn't have), `config.py`, `main.py`, `database.py`, `models/`, `schemas/`.
- **mutmut skips decorated functions**, i.e. every FastAPI route handler, so the normal run never mutates their bodies.
  `./scripts/run_mutation_tests.sh handlers` does: it mutates a throw-away copy of `backend/` in which each decorator is
  moved behind its function (`backend/scripts/mutation_handlers_setup.py`; the repo isn't touched), scoped to
  `app/api/v1/`, ~1 minute. Its baseline (2026-09-21): **1503 of 1811 killed (83%)**. Most of the ~300 survivors are
  message wording (`detail=`), rate-limit bucket *names* (`'ai_grade:user'` → `None`; harmless as long as the keys
  differ) and SQL shape (`order_by`, join conditions SQLAlchemy infers anyway). The real ones — statistics, the DSGVO
  export, per-user limit keys, the hourly code quota — are tested. Two handlers are big enough that logic inline
  is a smell: `export_user` (~100 lines) and `exam_stats` (~40); splitting them into helpers would let the normal run
  cover them.
- **Score (2026-09-21): about 1440 of 1608 mutants killed (90%)**, ~168 survivors, ~1 minute per run (±1–2 between
  runs: timing-dependent rate-limit tests). History: the first run over the 8 core modules killed 361 of 407 (88%);
  tests for the real gaps it found took that to 384 (94%). Widening to services and API helpers added ~1200 mutants
  and found more (e.g. `remove_focus_if_topic_learned` deleting *every* learner's mark for a topic, `_running_attempts`
  and `_progress_row` not scoped to the user, an OTP that could be replayed, the KPI window lengths) — all now tested.
- **What survives is judged, not chased.** The remaining ones are equivalent or not worth a test: `>` vs `>=` on
  timestamps that never compare equal, log and `detail=` message wording, the text of the KPI report and e-mails
  (`kpis.format_report` alone is ~33 of the survivors), `86401` vs `86400`, `partition` vs `rpartition` on validated single-`@`
  addresses, `call_next(None)` (Starlette ignores the argument), renamed throttle/log keys, `XXXX` as an unused
  default, the HMAC label of the OTP key (a pure constant), and `populate_existing` in `ai_quota._locked_user`
  (needs a stale-session race to observe). A new survivor in a module not on this list deserves a look.
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

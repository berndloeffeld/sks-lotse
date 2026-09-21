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

- **Scope** (`[tool.mutmut]` in `backend/pyproject.toml`, `only_mutate`): the pure logic in `core/` (progress, exam,
  exam_variant, email_address, cache, rate_limit, otp), all of `services/` except the catalog importer
  (`ai_quota`, `focus`, `user`, `grader`, `kpis`, `email`) and the helper functions in `api/v1/` (exams, progress,
  auth, questions, admin). Left out on purpose: `catalog_seed.py`/`scripts/` (parse and migration code whose tests read
  the PDF, which `mutants/` doesn't have), `config.py`, `main.py`, `database.py`, `models/`, `schemas/`.
- **mutmut skips decorated functions**, i.e. every FastAPI route handler (`@router.get(...)`), so their bodies are
  never mutated. What the handlers delegate to undecorated helpers (`_get_attempt`, `_topic_or_404`, `_consume_otp_code`,
  …) is covered; logic written inline in a handler is not. When a survivor points at such a gap, the fix is a test on
  the endpoint — and, for anything sizeable, moving the logic into a helper so it can be mutated.
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

# Mutation testing

Coverage says which lines the tests *run*; mutation testing says whether they would *notice a bug*.
The tool changes the code one small step at a time (`>=` → `>`, `and` → `or`, a constant, a dropped
line — a "mutant") and re-runs the tests. A mutant a test fails on is **killed**; one that still
passes **survived**, i.e. the tests don't pin that behavior down. Mutation score = killed / all.

**It runs daily** (03:00 UTC, `.github/workflows/mutation-testing.yml`, also startable by hand from the
Actions tab), not on every PR — it takes about 5 minutes in CI and must not hold up merges. A failed run opens an issue
("Mutation testing failed"); a regression therefore surfaces up to a day after the change that caused it. The backend job fails if fewer than
`MUTATION_MIN_SCORE` (87%, `scripts/run_mutation_tests.sh`) of the mutants are killed. That is a ratchet a few
points under the current score (~90%), like the coverage gates: raise it when the score settles higher, never
lower it to get a PR through. 100% is neither reachable (equivalent mutants) nor the goal, and a score
that is optimised for stops measuring anything — the check is there to catch regressions. Two limits to keep in
mind: an aggregate score over ~1600 mutants barely moves for a small new function (50 surviving mutants ≈ 3 points),
so when you add logic, look at the survivor list the job prints, not just at pass/fail; and the run is ±1–2
mutants noisy (timing-dependent rate-limit tests), which the margin absorbs.

**Keep `only_mutate` current** (`backend/pyproject.toml`): it is the whole scope, and a module missing from it is
silently unchecked. Add new business-logic modules in the PR that introduces them; `backend/tests/test_mutation_scope.py`
fails otherwise (it is ignored inside mutmut's own runs, since the handlers mode rewrites `only_mutate`).

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
  exam_variant, email_address, cache, rate_limit, otp, jwt, security_headers, canonical_domain, ai_quota), all of `services/` except the catalog importer
  (`ai_quota`, `focus`, `user`, `grader`, `kpis`, `email`) and the helper functions in `api/v1/` (exams, progress,
  auth, questions, admin, grading). Left out on purpose: `catalog_seed.py`/`scripts/` (parse and migration code whose tests read
  the PDF, which `mutants/` doesn't have), `config.py`, `main.py`, `database.py`, `models/`, `schemas/`.
- **mutmut skips decorated functions**, i.e. every FastAPI route handler, so the normal run never mutates their bodies.
  `./scripts/run_mutation_tests.sh handlers` does: it mutates a throw-away copy of `backend/` in which each decorator is
  moved behind its function (`backend/scripts/mutation_handlers_setup.py`; the repo isn't touched), scoped to
  `app/api/v1/`, ~1 minute. Its baseline (2026-09-21): **1503 of 1811 killed (83%)**. Most of the ~300 survivors are
  message wording (`detail=`), rate-limit bucket *names* (`'ai_grade:user'` → `None`; harmless as long as the keys
  differ) and SQL shape (`order_by`, join conditions SQLAlchemy infers anyway). The real ones — statistics, the DSGVO
  export, per-user limit keys, the hourly code quota — are tested. The two handlers that used to be big enough for
  inline logic to be a smell are split now: the DSGVO export lives in `services/admin_users.py`, the exam statistics
  in `services/exam.py::stats`, so the normal run covers both.
- **Score (2026-09-25): 3058 of 3386 mutants killed (90.3%)**, after going through the `email` and `payments` survivors
  (88.4% before: 2992). The mutant count had grown with the admin 2FA, payments and branded-mail modules. What was
  *not* wording and is tested now: the Berlin time in the purchase confirmation, the exact § 312f/§ 356 BGB content of that
  mail (labels, waiver sentence, separators), the legal footer links, the Resend API key, the log lines the runbook
  tells the operator to act on (`refund manually`, `send it by hand`, with payment and user ids), and that a redelivered
  webhook is recognised before another credit is attempted. Left on purpose: the wording of the login-code mails,
  exception messages nobody reads, and three time-zone mutants (`astimezone(None)`, the case of `"Europe/Berlin"`) that only
  differ on a machine that isn't in Berlin time or has a case-sensitive file system — a local run understates the CI score there.
  Before that (2026-09-24): 2555 of 2868 (89.1%), ~310 survivors, ~1 minute per run (±1–2 between
  runs: timing-dependent rate-limit tests). History: the first run over the 8 core modules killed 361 of 407 (88%);
  tests for the real gaps it found took that to 384 (94%). Widening to services and API helpers added ~1200 mutants
  and found more (e.g. `remove_focus_if_topic_learned` deleting *every* learner's mark for a topic, `_running_attempts`
  and `_progress_row` not scoped to the user, an OTP that could be replayed, the KPI window lengths) — all now tested.
- **What survives is judged, not chased.** The remaining ones are equivalent or not worth a test: `>` vs `>=` on
  timestamps that never compare equal, log and `detail=` message wording, the text of the KPI report and e-mails
  (`kpis.format_report` alone is ~33 of the survivors), `86401` vs `86400`, `partition` vs `rpartition` on validated single-`@`
  addresses, `call_next(None)` (Starlette ignores the argument), renamed throttle/log keys, `XXXX` as an unused
  default, the HMAC label of the OTP key (a pure constant), and `populate_existing` in `services/user.locked_user`
  (needs a stale-session race to observe). A new survivor in a module not on this list deserves a look.
- The two test files that read files outside `backend/` (`test_catalog_seed.py`,
  `test_integration_collection.py`) are ignored in the mutation run; they cover none of the scoped modules.

## Frontend (Stryker)

```bash
cd frontend && npm ci                                   # once
./scripts/run_frontend_mutation_tests.sh                # ~2 min; clear-text survivors + HTML report in frontend/reports/mutation/
./scripts/run_frontend_mutation_tests.sh gate           # what CI runs: fails below the minimum score
```

- **Scope** (`mutate` in `frontend/stryker.config.json`): the logic modules — `format.ts`, `ads.ts`, `analytics.ts`,
  `labels.ts`, `contact.ts`, `api/client.ts`, `store/authStore.ts`, and the hooks (`useExam`, `useExamCountdown`,
  `useExamVariantUpdate`, `useProgressSummary`). Components and pages are deliberately out for now: their mutants are
  mostly markup and class names, and only page-level tests cover them, which makes runs slow and survivors noisy.
  `src/test/mutationScope.test.ts` keeps the list current (same idea as the backend's `test_mutation_scope.py`).
- **Setup**: `@stryker-mutator/core` + `vitest-runner` + `typescript-checker` (exact versions), `coverageAnalysis: perTest`
  (each mutant only runs the tests that cover it, ~12 per mutant). The TypeScript checker drops mutants that don't compile
  (≈60 of ~300) instead of counting them as survivors.
- **Score (2026-09-25): 417 of 440 counted mutants killed (94.8%)**, ~4 minutes (2026-09-21: 226 of 236, 95.8%). Minimum in CI: **90%**
  (`MUTATION_MIN_SCORE`), a ratchet like the others. The first run (7 modules) scored 81%; the survivors were real
  gaps (no test for `formatDateTime`, `put`/`delete`, body-less requests, the countdown's expiry boundary and
  latest-callback handling, the auth store's loading state, logout URL, wiring of the unauthorized handler) and the
  hooks, which had only been exercised through pages, got their own tests.
- **Remaining survivors are equivalent:** `body === undefined ? undefined : JSON.stringify(body)` → `JSON.stringify(body)`
  (`JSON.stringify(undefined)` is `undefined` anyway), `.catch(() => null)` vs `() => undefined`, the `?? ''` default of
  `VITE_API_BASE_URL` (a build-time config), the countdown's initial state (overwritten by the immediate tick), and
  the dependency arrays of `useCallback`/`useEffect` in `useProgressSummary` (the callbacks are stable; a wrong array
  needs a re-render race to observe).
- **The gate refuses a broken runner.** `@stryker-mutator/vitest-runner` 10.0.0 doesn't work with Vitest 5: it filters
  tests by name with a space-joined path, Vitest 5 joins with ` > `, so no test runs and *every* mutant "survives"
  ([stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)), while Stryker still exits 0. Hence Vitest
  and `@vitest/coverage-v8` are pinned to 4.1.11 ([ADR-0035](adr/0035-vitest-pinned-to-4x-for-stryker.md)), Dependabot ignores
  their major bumps, and `gate` fails when a surviving mutant ran zero tests. Symptoms of the broken runner: a score under
  ~20% and "Ran 0.00 tests per mutant on average" — that means the runner, not the tests.

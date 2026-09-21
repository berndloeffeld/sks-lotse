# 0035. Vitest pinned to 4.x so Stryker mutation testing works

Status: Accepted

## Context

The frontend gets mutation testing with Stryker (see `docs/mutation-testing.md`), the counterpart of the backend's
mutmut job. `@stryker-mutator/vitest-runner` 10.0.0 — the latest release — doesn't work with Vitest 5: it selects the
tests that cover a mutant with a name filter built from the space-joined suite path, Vitest 5 separates with `" > "`,
so the filter matches nothing, no test runs, and every mutant "survives" while Stryker still exits 0
([stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210), reproduced on 5.0.1 here: 13% score,
"0 tests per mutant"). Fix PRs upstream (#6214, #6220) were open but unreleased. The project had been on Vitest 5.0.1.

Considered: wait (no frontend mutation testing for an unknown time); patch the runner (`patch-package` or an unreleased
branch — fragile, a fix for the name filter may still leave a reported second problem with static mutants under Vitest 5);
pin Vitest back to 4.x.

## Decision

`vitest` and `@vitest/coverage-v8` are pinned to exactly 4.1.11 (the last version verified with the runner), Stryker
packages to exactly 10.0.0. Dependabot ignores semver-major updates of the two Vitest packages. The gate script
(`scripts/run_frontend_mutation_tests.sh gate`) fails if a surviving mutant ran no tests, so a Vitest bump that breaks the
runner again turns the job red instead of quietly reporting 0%.

## Consequences

The tests use only standard Vitest APIs; nothing in the suite needed changing for 4.x, and the coverage gates hold. We
give up Vitest 5 features until the runner is fixed. **Revisit** when a `@stryker-mutator/vitest-runner` release lists
Vitest 5 support: bump `vitest` and `@vitest/coverage-v8` to 5.x, run the gate (score should match ~95%), remove the
Dependabot ignore, and mark this ADR superseded.

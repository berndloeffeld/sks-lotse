## What and why

<!-- One or two sentences: what changes for learners/operators, or what the code change fixes. -->

## Definition of Done

The "in the same PR" duties from `CLAUDE.md`. Tick what applies, strike through (`~~…~~`) what doesn't.

- [ ] `docs/FEATURES.md` updated (what learners/operators can do, prices, what is live)
- [ ] `docs/NON-FUNCTIONAL-REQUIREMENTS.md` updated (expected load, limits, security, availability, performance)
- [ ] `docs/ARCHITECTURE.md` / `docs/RUNBOOK.md` still describe what exists
- [ ] ADR added for a costly-to-reverse or non-obvious decision (index row and `Status:` line match; a superseded ADR is marked)
- [ ] API changed: `./scripts/generate_postman_collection.sh` run, collection + `frontend/src/api/schema.gen.ts` committed
- [ ] Endpoint added/changed/removed: `postman/integration-tests.postman_collection.json` requests and `pm.test` assertions updated (happy path + main validation failure; old field names grepped)
- [ ] New/renamed/deleted logic module: mutation scope updated (`only_mutate` in `backend/pyproject.toml`, `mutate` in `frontend/stryker.config.json`)
- [ ] New table: cleanup of transient rows, indexes for the read pattern, throttled maintenance, caching considered
- [ ] New personal data: deleted with the account, in the admin export, described in the Datenschutzerklärung
- [ ] AGB or privacy text changed: `CURRENT_AGB_VERSION` (`backend/app/domain/legal.py`) and `AGB_VERSION_LABEL` (`frontend/src/legal.ts`) bumped together for the AGB, the "Stand:" of the Datenschutzerklärung updated by hand
- [ ] New environment variable: in `Settings` and `backend/.env.example` (a new secret also in `render.yaml` and the runbook's secrets table)

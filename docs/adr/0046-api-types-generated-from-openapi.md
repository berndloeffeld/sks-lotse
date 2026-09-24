# 0046. Frontend API types generated from the OpenAPI schema

Status: Accepted — amends [ADR-0013](0013-frontend-architecture-and-tooling.md): the API types are generated now, the client stays hand-written

## Context

ADR-0013 kept the frontend's API types hand-written, since the API had 7 endpoints at the time, and said to revisit that once the surface grew. It has grown: about 40 routes and some 30 response shapes, which `frontend/src/api/types.ts` mirrored field by field ("Mirrors backend/app/schemas/…"). Nothing checked that mirror. The first generated run found real drift: the DSGVO export's progress rows had carried `last_correct_at` for weeks, but the frontend type didn't have it.

The backend already publishes its schema: `scripts/generate_postman_collection.sh` dumps `app.openapi()` for the generated Postman collection, and CI fails when that collection is stale.

## Decision

The same script also runs `openapi-typescript` (pinned, run via `npx` like `openapi-to-postmanv2`) over that schema and writes `frontend/src/api/schema.gen.ts`. It keeps only the component schemas: the frontend types its calls by hand in `api/client.ts`, and the paths would triple the file. The file is committed, because the Render static-site build has no Python to produce it, and it is excluded from Prettier, ESLint and the Stryker scope. The `postman-collection` CI job fails when it is stale, just as it does for the collection.

`api/types.ts` shrinks to aliases (`export type User = Schemas['UserRead']`) plus the literal types the schema can't express. The backend validates exam variant, outcome, exam status/result and block kind as plain strings on purpose: an OpenAPI `enum` makes the Postman generation non-deterministic (`backend/app/schemas/common.py::one_of`). `types.ts` narrows those fields to their literal unions with a small `Narrow<T, …>` helper.

## Consequences

- **Easier:** a backend schema change shows up as a type change in the same PR, and `tsc -b` points at every place in the frontend it affects. Adding a response shape takes one line.
- **Harder:** an API change now means running `./scripts/generate_postman_collection.sh` and committing two generated files. A new literal-valued field still has to be narrowed by hand in `types.ts`. Otherwise it is typed as `string`, which is safe but loses exhaustiveness checks.
- **Rejected: a generated client** (`openapi-fetch` and the like). The 401 and maintenance-mode handling of `api/client.ts` would have to move into its middleware, and the call sites are few and simple. The types are where the drift was.
- **Rejected: enums in the backend schema** instead of the literal overrides. That would put the non-deterministic Postman examples back.
- **Rejected: committing the full output** (about 2,450 lines, paths included) for a file nobody reads.

# 0003. Synchronous grading requests

Status: Accepted

## Context

The core learning loop (learner submits a free-text answer, gets it graded against the official model answer) requires a call to the OpenAI API. That call needs to fit into the request architecture: synchronous (request blocks until the graded result is ready) or asynchronous (the grading request kicks off a background job; the client polls or is notified when it's done).

Expected OpenAI latency for a single grading call is on the order of a few seconds, not tens of seconds or more. There's no batching benefit (each grading request is for one learner's one answer), and there is exactly one client waiting for exactly one result — there's no fan-out or multi-consumer scenario that would justify a queue.

Options considered:
1. **Synchronous** — the backend calls OpenAI inline within the HTTP request handler and returns the graded result directly in the response.
2. **Asynchronous (queue + worker)** — the request enqueues a grading job and returns immediately; the frontend polls a status endpoint (or uses a websocket/SSE) until the result is ready.

## Decision

Grading requests are **synchronous**: the backend calls OpenAI inline and returns the result in the same HTTP response, with a sensible timeout (to be set relative to observed OpenAI latency, not guessed upfront) and a clear error response if OpenAI times out or fails.

## Consequences

- No queue, no worker process, no job-status storage or polling endpoint to build and operate — meaningfully less infrastructure for a solo-maintained MVP.
- The request-handling thread/worker is occupied for the duration of the OpenAI call; at meaningful concurrent load this could become a bottleneck for the web server's worker pool. Not a concern at current expected scale (see [ADR-0002](0002-modulith-over-microservices.md)).
- A slow or failed OpenAI call is directly visible to the learner as a slow or failed request — there's no way to shield them behind a "processing..." state without adding the async machinery this ADR is avoiding. Acceptable tradeoff for now; needs a clear timeout and a good error message rather than a hanging request.
- Revisit if: OpenAI latency regularly exceeds several seconds in practice, or concurrent grading requests start measurably degrading the backend for other endpoints.

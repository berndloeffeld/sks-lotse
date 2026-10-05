# Security Policy

SKS Lotse is an early-stage, solo-maintained project. If you find a security vulnerability, please report it privately rather than opening a public issue.

## Reporting a vulnerability

Either use GitHub's [private vulnerability reporting](https://github.com/berndloeffeld/sks-lotse/security/advisories/new) (Security tab → "Report a vulnerability"), or email **kontakt@sks-lotse.de**, with a description of the issue and steps to reproduce. I aim to acknowledge reports within a few days and will keep you updated as it's fixed.

## Scope

There's no bug bounty program. Please act in good faith: don't access, modify, or exfiltrate other users' data beyond what's needed to demonstrate the issue, and allow a reasonable window to fix it before any public disclosure.

## What's already in place

- A dependency audit on every pull request (`pip-audit` for the backend locks, `npm audit` for high/critical issues in the frontend's runtime dependencies) blocks the merge on a known vulnerability.
- Static analysis with GitHub CodeQL (Python, JavaScript/TypeScript, GitHub Actions) on every pull request and on `main`.
- Dependency and static scanning via [Aikido Security](https://www.aikido.dev/) (it rescans about every three days, so it is no merge gate; an alert is triaged the same day, see `docs/RUNBOOK.md`) and Dependabot (weekly, with a short cooldown for new releases); backend dependencies are hash-locked.
- CI runs linting, the full test suite, and a coverage gate on every change.
- Sessions use httpOnly, `__Host-`-prefixed JWT cookies; rate limiting applies to all API routes, with tighter limits on login codes; request bodies are size-capped before they're read; the admin area needs a TOTP code, a fresh one for exporting or deleting an account, and admin actions are audit-logged.
- The admin audit trail is a log line per action (`admin action: …`, account ids only, no email or content), not a database table: it is kept only as long as the log service keeps logs (Better Stack, retention per its plan, see [docs/RUNBOOK.md](docs/RUNBOOK.md#observability)); deleting an account doesn't remove its lines earlier, they expire with the rest of the logs.
- This contact is also published as [`/.well-known/security.txt`](https://sks-lotse.de/.well-known/security.txt) (RFC 9116).

Thanks for helping keep this project and its users safe.

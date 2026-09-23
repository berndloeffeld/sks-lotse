# Security Policy

SKS Lotse is an early-stage, solo-maintained project. If you find a security vulnerability, please report it privately rather than opening a public issue.

## Reporting a vulnerability

Email **kontakt@sks-lotse.de** with a description of the issue and steps to reproduce. I aim to acknowledge reports within a few days and will keep you updated as it's fixed.

## Scope

There's no bug bounty program. Please act in good faith: don't access, modify, or exfiltrate other users' data beyond what's needed to demonstrate the issue, and allow a reasonable window to fix it before any public disclosure.

## What's already in place

- Dependency and static scanning via [Aikido Security](https://www.aikido.dev/) (findings reviewed by hand before each merge) and Dependabot (weekly, with a short cooldown for new releases); backend dependencies are hash-locked.
- CI runs linting, the full test suite, and a coverage gate on every change.
- Sessions use httpOnly JWT cookies; rate limiting applies to all API routes, with tighter limits on login codes; admin actions are audit-logged.

Thanks for helping keep this project and its users safe.

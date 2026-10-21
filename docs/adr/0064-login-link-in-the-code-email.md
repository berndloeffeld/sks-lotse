# 0064. A login link in the code email, redeemed by a click

Status: Accepted

## Context

Signing in is an email address plus a 6-digit one-time code. Typing the code over is a step many learners would rather skip, above all on Android and in webmail, where nothing fills it in for them (Safari does, from Apple Mail, via `autocomplete="one-time-code"`). The usual answer is a link in the same email that signs in on its own.

A link brings risks the code doesn't have, or has less of:

- **Mail scanners open links.** Outlook Safe Links, Defender, Gmail's and many corporate gateways fetch every URL in an incoming mail to check it. A link that signs in on its `GET` would be used up, and the scanner's request would get the session, before the learner ever clicks.
- **URLs leak.** A token in the path or query string ends up in the static host's access logs, in `Referer` headers and in the analytics pageview.
- **Login CSRF.** Someone can request a link for their own address and send it to someone else, who then learns (or buys tokens) in the sender's account without noticing. The code allows the same, but a link makes it a single click.

## Decision

- The login email carries a link, `/login/link#t=<token>`, beside the code (still there, for a second device or a browser the link doesn't open in). The token is 256 random bits (`secrets.token_urlsafe(32)`), stored only as an HMAC with its own key derived from `JWT_SECRET` (`hash_link_token`, `app/core/otp.py`), in a new `otp_codes.link_hash` column of the **same row** as the code. Code and link are one login: redeeming either uses up both, and expiry, the per-address quotas and "only the latest code counts" apply to both alike. Email-change codes get no link.
- The token sits in the URL's **fragment**, which a browser never sends to a server. The page clears it from the address bar and the history at once, and doesn't load Umami (`wantsAnalytics`).
- The page signs in **only on a click** ("Jetzt anmelden"), with `POST /auth/otp/verify-link {token}`. Nothing happens on load, so a scanner, even one that runs JavaScript, uses nothing up.
- `verify-link` shares everything after redeeming with `verify` (blocklist check, account creation with the signup bonus, `last_login_at`, the session cookie). It has no attempts counter (a 256-bit token can't be guessed), but its own per-IP rule with the code's numbers. Wrong code guesses don't disable the link: the attempts cap protects the 6-digit code, and someone spending it for another person's address must not take that person's link down too.

## Consequences

- One step less to sign in, on any mail client, with the same lifetime and single use as the code. Guessing gets harder, not easier.
- The session lands in the browser the link is opened in, often a mail app's in-app browser on a phone, not necessarily the one that asked for the code. The mail says so; the code is the way for the other device.
- Login CSRF stays an accepted residual risk, as with the code. Rejected: binding the link to the requesting browser with a nonce cookie. It would close that, but break exactly the cases the link is for (the in-app browser, another device). Rejected as well: showing the address on the confirmation page. It would need a lookup that doesn't use up the link, a second open endpoint for a small gain.
- Rejected: signing in on the link's `GET` (scanners), a token in the query string (logs, Referer, analytics), and a signed JWT as the link (stateless, so it couldn't be single-use or die with its code without a table anyway).

# 0041. No ad script in the logged-in app

Status: Accepted (partially supersedes [ADR-0027](0027-adsense-with-google-consent-management.md): its "every page carries it")

## Context

ADR-0027 put Google's AdSense script into the `<head>` of every served page, including `app.html`, the shell of every logged-in route. That script runs as same-origin JavaScript on `sks-lotse.de`. The API at `api.sks-lotse.de` accepts that origin with credentials (CORS, `allow_credentials`), and the session cookie is `SameSite=Lax` on the same site. So anything running in that page can call the API as the logged-in learner, and on an operator's session that includes the admin tools: `GET /admin/users/{id}/export`, `DELETE /admin/users/{id}`. It can also read what is typed into the page, such as a login code. The cookie being `httpOnly` doesn't help here: the script never needs to read the token, the browser attaches it.

AdSense's own code is not the realistic threat. The risk is any compromise or malvertising along the ad-serving chain, which the operator has no control over. Meanwhile the logged-in app renders no ad units at all (ARCHITECTURE.md: "No ad units are rendered yet"). The script was a risk with no benefit there, and ads-removed accounts loaded it too (ADR-0027 addendum 2026-09-21).

Options considered:
1. **Keep the script everywhere, rely on CSP.** The script allowlist has to include Google's ad hosts, and those serve changing code. CSP can't separate "Google's ad code" from "anything that code loads".
2. **Serve ads from a sandboxed iframe on another origin.** That is real isolation, but AdSense doesn't support being wrapped like this, and site verification needs the tag in our own pages.
3. **Script only on the public pages.** Chosen.

## Decision

- **`scripts/prerender.mjs` strips the AdSense tag from `app.html`.** The build fails if any trace of it remains. The four prerendered public pages (`/`, `/faq`, `/imprint`, `/privacy`) keep the tag in their source, as AdSense's site verification requires.
- **`routes/AdFreeDocument.tsx` wraps `/login` and every logged-in route.** A document that started on a public page still has the script after client-side navigation, e.g. landing page → "Anmelden". Such a document is left by one full load of the same URL, which Render serves as the script-free `app.html`. The check runs before anything renders, so the login form never appears in a document with ad code. A one-shot `sessionStorage` marker stops a reload loop if a misconfigured rewrite ever serves a page with the script there. If storage is unavailable, the page doesn't reload, which risks no loop but keeps the script.
- **"Cookie-Einstellungen" keeps working everywhere** (withdrawal as easy as consent, Art. 7(3) DSGVO). Where there is no consent API (the app shell), it opens `/privacy?cookie-einstellungen`, a public page that loads the script and queues Google's revocation dialog on arrival.

## Consequences

- Logged-in pages, the login form and the admin tools never run third-party ad code. Ads-removed accounts no longer load Google's script while using the app. They still load it on the public pages, the same as any visitor.
- Going from a public page into the app costs one extra page load.
- Any future ad unit inside the app needs its own decision. The options are loading the script at runtime for accounts that see ads (never on `/admin`), or confining ads to the public pages.
- The Datenschutzerklärung's AdSense section stays accurate: it describes processing that now happens on fewer pages.
- The CSP in `render.yaml` is unchanged. The public pages still need Google's hosts. A per-path policy (a stricter one for `app.html`) is possible later, but Render applies header rules by path pattern and the SPA fallback serves `app.html` under every app path, so it would need care.

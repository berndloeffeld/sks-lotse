#!/usr/bin/env bash
# One-off check of the API proxy on sbf-lotse.de (ADR-0069), before SBF Lotse's accounts use it:
#   1. the rewrite reaches the backend (GET /api/v1/pricing, both ways),
#   2. optionally a real login through it: Set-Cookie arrives, /auth/me answers with it,
#   3. the backend sees the learner's IP behind the rewrite, not the CDN's.
#
# Step 3 uses the per-IP limit of POST /auth/otp/verify-link (30 an hour): it uses up that
# bucket directly on api.sks-lotse.de, then sends one request through sbf-lotse.de. A 429 there
# means both landed in the same bucket, i.e. the proxy passes the learner's IP on. Afterwards login
# links don't work from this network for up to an hour; the login code does.
#
#   scripts/check_sbf_proxy.sh                  # steps 1 and 3
#   CHECK_EMAIL=you@example.com scripts/check_sbf_proxy.sh   # also step 2 (sends a login code)
set -euo pipefail

PROXY=${PROXY:-https://sbf-lotse.de}
DIRECT=${DIRECT:-https://api.sks-lotse.de}
LIMIT=${LIMIT:-30}
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
bogus_link() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$1/api/v1/auth/otp/verify-link" \
    -H 'Content-Type: application/json' -d '{"token":"proxycheckproxycheckproxycheckproxycheck000"}'
}

echo "1. Reachability"
direct=$(status "$DIRECT/api/v1/pricing")
proxied=$(curl -s -D - -o /dev/null "$PROXY/api/v1/pricing")
echo "   direct:  $direct"
echo "   proxied: $(head -1 <<<"$proxied" | tr -d '\r')"
grep -i -E '^(content-type|x-request-id):' <<<"$proxied" | sed 's/^/     /' || true
# Without the rewrite the SPA fallback answers 200 too, with app.html: only JSON counts.
if ! head -1 <<<"$proxied" | grep -q ' 200' || ! grep -qi '^content-type: application/json' <<<"$proxied"; then
  echo "   FAIL: the rewrite doesn't reach the API (is the render.yaml route deployed?)"
  exit 1
fi

if [[ -n "${CHECK_EMAIL:-}" ]]; then
  echo "2. Login through the proxy"
  echo "   code request: $(curl -s -o /dev/null -w '%{http_code}' -X POST "$PROXY/api/v1/auth/otp/request" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$CHECK_EMAIL\"}")"
  read -r -p "   Code from the mail: " code
  curl -s -D - -o /dev/null -c "$JAR" -X POST "$PROXY/api/v1/auth/otp/verify" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$CHECK_EMAIL\",\"code\":\"$code\"}" |
    grep -i -E '^(HTTP|set-cookie)' | sed -E 's/=[^;]{12,}/=<token>/' | sed 's/^/     /'
  echo "   /auth/me with the cookie: $(status -b "$JAR" "$PROXY/api/v1/auth/me") (200 = cookie works)"
  echo "   logout: $(status -b "$JAR" -X POST "$PROXY/api/v1/auth/logout")"
fi

echo "3. Client IP behind the rewrite"
codes=""
for _ in $(seq "$LIMIT"); do codes+="$(bogus_link "$DIRECT") "; done
echo "   $LIMIT direct requests: $(tr ' ' '\n' <<<"$codes" | sort | uniq -c | tr '\n' ' ')"
echo "   one more, direct:  $(bogus_link "$DIRECT") (expected 429: the bucket is full)"
via=$(bogus_link "$PROXY")
echo "   one more, proxied: $via"
if [[ "$via" == 429 ]]; then
  echo "   OK: the backend sees this network's IP through the proxy."
else
  echo "   FAIL: through the proxy the backend sees another IP (the CDN's?). ADR-0069: reopen the decision."
fi

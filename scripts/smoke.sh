#!/bin/sh
set -eu
: "${BASE_URL:?Set BASE_URL}"
: "${ADMIN_USERNAME:?Set ADMIN_USERNAME}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
base=${BASE_URL%/}
status=$(curl -fsS "$base/api/app/status")
printf '%s' "$status" | grep -q '"code":0'
printf '%s' "$status" | grep -q '"version":"0.9.133"'
curl -fsS "$base/" | grep -q 'Cronicle'
bad=$(curl -sS -o /tmp/cronicle-bad -w '%{http_code}' -H 'Content-Type: application/json' --data '{"username":"railway-template-missing-user","password":"wrong-template-probe"}' "$base/api/user/login")
[ "$bad" = "200" ]
grep -q '"code":"login"' /tmp/cronicle-bad
good=$(curl -sS -o /tmp/cronicle-good -w '%{http_code}' -H 'Content-Type: application/json' --data "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" "$base/api/user/login")
[ "$good" = "200" ]
grep -q '"code":0' /tmp/cronicle-good
rm -f /tmp/cronicle-bad /tmp/cronicle-good
printf '%s\n' 'Cronicle smoke checks passed'

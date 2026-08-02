#!/bin/sh
set -eu

: "${CRONICLE_ADMIN_USERNAME:=admin}"
: "${CRONICLE_ADMIN_PASSWORD:?CRONICLE_ADMIN_PASSWORD is required}"
: "${CRONICLE_ADMIN_EMAIL:=admin@localhost}"
: "${CRONICLE_PUBLIC_DOMAIN:?CRONICLE_PUBLIC_DOMAIN is required}"
: "${CRONICLE_SECRET_KEY:?CRONICLE_SECRET_KEY is required}"

mkdir -p /opt/cronicle/data /tmp/cronicle-logs /tmp/cronicle-queue
chown -R node:node /opt/cronicle/data /tmp/cronicle-logs /tmp/cronicle-queue
node /usr/local/lib/cronicle-configure.mjs

if [ ! -f /opt/cronicle/data/.railway-initialized ]; then
  gosu node node bin/storage-cli.js setup
  gosu node node bin/storage-cli.js admin "$CRONICLE_ADMIN_USERNAME" "$CRONICLE_ADMIN_PASSWORD" "$CRONICLE_ADMIN_EMAIL"
  gosu node touch /opt/cronicle/data/.railway-initialized
fi

touch /tmp/cronicle-logs/combined.log
chown node:node /tmp/cronicle-logs/combined.log
tail -n 0 -F /tmp/cronicle-logs/combined.log &

unset CRONICLE_ADMIN_PASSWORD CRONICLE_SECRET_KEY
exec gosu node node lib/main.js

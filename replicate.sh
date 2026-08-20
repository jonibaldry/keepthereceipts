#!/bin/sh
# Runs only when SLAVE_MODE is set (see docker-entrypoint.sh) — its value is
# the upstream DNSLink domain to mirror, e.g. keepthereceipts.net.
#
# Periodically resolves that domain's published root and recursively pins
# it onto this container's own IPFS node, so the node fetches and keeps
# every block of the archive (vault.db and every /vault/document/<id>/...)
# and becomes another provider for it on the network — not just a one-off
# download. The mirrored vault.db is then copied out to DB_PATH so this
# frontend's own read path serves the replicated index.
set -eu

DOMAIN="${SLAVE_MODE:?SLAVE_MODE must be set to the upstream DNSLink domain}"
IPFS_API="${IPFS_API:-/dns4/127.0.0.1/tcp/5001}"
DB_PATH="${DB_PATH:-/data/db/vault.db}"
INTERVAL="${REPLICATE_INTERVAL:-60}"
STATE_DIR="${STATE_DIR:-/var/lib/replicator}"
LAST_ROOT_FILE="${STATE_DIR}/last.root"

mkdir -p "$STATE_DIR" "$(dirname "$DB_PATH")"

while true; do
  root=$(ipfs --api="$IPFS_API" resolve -r "/ipns/${DOMAIN}" 2>/dev/null || true)

  if [ -z "$root" ]; then
    echo "replicate: could not resolve dnslink for ${DOMAIN}, retrying in ${INTERVAL}s" >&2
    sleep "$INTERVAL"
    continue
  fi

  last_root=$(cat "$LAST_ROOT_FILE" 2>/dev/null || true)
  if [ "$root" = "$last_root" ]; then
    sleep "$INTERVAL"
    continue
  fi

  echo "replicate: mirroring ${root}"
  if ! ipfs --api="$IPFS_API" pin add -r "$root" >/dev/null; then
    echo "replicate: pin failed for ${root}, will retry next cycle" >&2
    sleep "$INTERVAL"
    continue
  fi

  tmp="${DB_PATH}.tmp"
  if ipfs --api="$IPFS_API" cat "${root}/vault.db" >"$tmp" 2>/dev/null && [ -s "$tmp" ]; then
    mv "$tmp" "$DB_PATH"
  else
    echo "replicate: ${root} has no vault.db yet" >&2
    rm -f "$tmp"
  fi

  echo "$root" >"$LAST_ROOT_FILE"

  # The old root's own pin is redundant once the new one covers everything
  # still current (unchanged blocks, e.g. untouched documents, stay pinned
  # via the new root) — unpin it so anything genuinely stale is eligible
  # for `ipfs repo gc`.
  if [ -n "$last_root" ] && [ "$last_root" != "$root" ]; then
    ipfs --api="$IPFS_API" pin rm "$last_root" 2>/dev/null || true
  fi

  sleep "$INTERVAL"
done

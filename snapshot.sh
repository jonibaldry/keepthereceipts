#!/bin/sh
# Periodically takes a consistent SQLite backup and publishes it into the
# IPFS node's MFS, decoupled from litestream's continuous WAL replication.
set -eu

DB_PATH="${DB_PATH:-/data/db/vault.db}"
IPFS_API="${IPFS_API:-/dns4/ipfs-node/tcp/5001}"
VAULT_DIR="${VAULT_DIR:-/vault}"
MFS_DIR="${MFS_DIR:-${VAULT_DIR}/snapshots}"
INTERVAL="${SNAPSHOT_INTERVAL:-60}"
STATE_DIR="${STATE_DIR:-/var/lib/snapshotter}"
LAST_HASH_FILE="${STATE_DIR}/last.sha256"
DNS_LINK_SCRIPT="${DNS_LINK_SCRIPT:-/usr/local/bin/dns-link.sh}"

mkdir -p "$STATE_DIR"
ipfs --api="$IPFS_API" files mkdir -p "$MFS_DIR"

while true; do
  sleep "$INTERVAL"

  if [ ! -f "$DB_PATH" ]; then
    echo "waiting for ${DB_PATH} to exist..."
    continue
  fi

  ts=$(date -u +%Y%m%dT%H%M%SZ)
  tmp="/tmp/vault-${ts}.db"

  sqlite3 "$DB_PATH" ".backup '${tmp}'"

  hash=$(sha256sum "$tmp" | awk '{print $1}')
  last_hash=$(cat "$LAST_HASH_FILE" 2>/dev/null || true)

  if [ "$hash" = "$last_hash" ]; then
    echo "snapshot ${ts}: unchanged (sha256=${hash}), skipping"
    rm -f "$tmp"
    continue
  fi

  cid=$(ipfs --api="$IPFS_API" add -Q --cid-version=1 "$tmp")
  ipfs --api="$IPFS_API" files cp "/ipfs/${cid}" "${MFS_DIR}/${ts}.db"
  ipfs --api="$IPFS_API" files rm -f "${MFS_DIR}/latest.db" 2>/dev/null || true
  ipfs --api="$IPFS_API" files cp "/ipfs/${cid}" "${MFS_DIR}/latest.db"

  root=$(ipfs --api="$IPFS_API" files stat --hash "$VAULT_DIR")
  echo "snapshot ${ts}: cid=${cid} vault_root=${root}"

  if "$DNS_LINK_SCRIPT" "$root"; then
    echo "$hash" >"$LAST_HASH_FILE"
  else
    echo "snapshot ${ts}: dns-link publish failed, will retry next cycle" >&2
  fi

  rm -f "$tmp"
done

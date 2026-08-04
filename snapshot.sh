#!/bin/sh
# Periodically takes a consistent SQLite backup and publishes it into the
# IPFS node's MFS, decoupled from litestream's continuous WAL replication.
#
# Only the latest snapshot is kept in MFS, at $VAULT_FILE (vault.db at the
# vault root) — there's no history of older snapshots here. litestream's
# WAL replica is the durability/point-in-time-recovery story; this is just
# "what's the current, content-addressed state of the database."
set -eu

DB_PATH="${DB_PATH:-/data/db/vault.db}"
IPFS_API="${IPFS_API:-/dns4/ipfs-node/tcp/5001}"
VAULT_DIR="${VAULT_DIR:-/vault}"
VAULT_FILE="${VAULT_FILE:-${VAULT_DIR}/vault.db}"
INTERVAL="${SNAPSHOT_INTERVAL:-60}"
STATE_DIR="${STATE_DIR:-/var/lib/snapshotter}"
LAST_HASH_FILE="${STATE_DIR}/last.sha256"
LAST_CID_FILE="${STATE_DIR}/last.cid"
DNS_LINK_SCRIPT="${DNS_LINK_SCRIPT:-/usr/local/bin/dns-link.sh}"

mkdir -p "$STATE_DIR"
ipfs --api="$IPFS_API" files mkdir -p "$VAULT_DIR"

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
  ipfs --api="$IPFS_API" files rm -f "$VAULT_FILE" 2>/dev/null || true
  ipfs --api="$IPFS_API" files cp "/ipfs/${cid}" "$VAULT_FILE"

  # `ipfs add` pins independently of MFS membership, so the snapshot we
  # just replaced is still pinned even though it's no longer reachable
  # from $VAULT_FILE. Unpin it so it's eligible for `ipfs repo gc` —
  # gc itself isn't run here, that's a separate, heavier operation left
  # to the operator or a periodic job.
  last_cid=$(cat "$LAST_CID_FILE" 2>/dev/null || true)
  if [ -n "$last_cid" ] && [ "$last_cid" != "$cid" ]; then
    ipfs --api="$IPFS_API" pin rm "$last_cid" 2>/dev/null || true
  fi

  root=$(ipfs --api="$IPFS_API" files stat --hash "$VAULT_DIR")
  echo "snapshot ${ts}: cid=${cid} vault_root=${root}"

  if "$DNS_LINK_SCRIPT" "$root"; then
    echo "$hash" >"$LAST_HASH_FILE"
    echo "$cid" >"$LAST_CID_FILE"
  else
    echo "snapshot ${ts}: dns-link publish failed, will retry next cycle" >&2
  fi

  rm -f "$tmp"
done

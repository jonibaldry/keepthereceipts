#!/bin/sh
# When SLAVE_MODE is set, this frontend is a mirror: it runs the DNSLink
# replication loop (replicate.sh) alongside the normal server so the local
# IPFS node stays synced with the upstream vault. Unset, this is just a
# regular frontend deployment and the loop never starts.
set -eu

if [ -n "${SLAVE_MODE:-}" ]; then
  /usr/local/bin/replicate.sh &
fi

exec "$@"

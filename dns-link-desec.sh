#!/bin/sh
# Publishes a DNSLink TXT record pointing at the given IPFS CID, via deSEC's
# REST API: https://desec.readthedocs.io/en/latest/dns/rrsets.html
#
# Requires:
#   DESEC_TOKEN   - deSEC API token
#   DESEC_DOMAIN  - the zone in your deSEC account, e.g. example.com
#   DESEC_SUBNAME - record name within the zone (default: _dnslink)
#   DESEC_TTL     - TTL in seconds (default: 3600)
#
# Usage: dns-link-desec.sh <cid>
set -eu

cid="${1:?usage: dns-link-desec.sh <cid>}"
: "${DESEC_TOKEN:?DESEC_TOKEN is not set}"
: "${DESEC_DOMAIN:?DESEC_DOMAIN is not set}"

subname="${DESEC_SUBNAME:-_dnslink}"
ttl="${DESEC_TTL:-3600}"
url="https://desec.io/api/v1/domains/${DESEC_DOMAIN}/rrsets/${subname}/TXT/"

# TXT record content must itself be double-quoted per DNS presentation
# format, so the record value ends up as the literal string:
#   "dnslink=/ipfs/<cid>"
payload=$(jq -n --arg val "dnslink=/ipfs/${cid}" --argjson ttl "$ttl" \
  '{ttl: $ttl, records: [("\"" + $val + "\"")]}')

http_status=$(curl -sS -o /tmp/dns-link-response.json -w '%{http_code}' \
  -X PUT "$url" \
  -H "Authorization: Token ${DESEC_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
  echo "[dns-link-desec] publish failed (HTTP ${http_status}): $(cat /tmp/dns-link-response.json)" >&2
  exit 1
fi

echo "[dns-link-desec] published dnslink=/ipfs/${cid} to ${subname}.${DESEC_DOMAIN}"

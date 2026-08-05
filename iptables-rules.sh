#!/bin/sh
# Host firewall for the keepthereceipts deployment: SSH plus the ports
# docker-compose.yml/docker-compose.prod.yml actually publish — Caddy's
# 80/443 and the IPFS swarm port 4001 (tcp+udp). Everything else inbound is
# dropped. The IPFS API (5001) and gateway (8080) are bound to 127.0.0.1 in
# both compose files, so they're already unreachable from outside and need
# no firewall rule of their own.
#
# Deliberately NOT an `iptables-restore` file: a full-table restore flushes
# every chain in the table, including the various DOCKER* chains dockerd
# creates and depends on for its own forwarding/NAT logic (exact chain set
# varies by Docker/nftables-backend version — e.g. DOCKER-BRIDGE/DOCKER-CT/
# DOCKER-FORWARD/DOCKER-INTERNAL on newer nf_tables-backed installs, DOCKER-
# ISOLATION-STAGE-1/2 on older ones). Replaying a full restore after Docker
# has started breaks container networking until dockerd restarts. This
# script only ever touches chains it owns, and is safe to re-run (each
# managed chain is flushed before being rebuilt) — verified directly
# against a real captured ruleset from this project's Docker host: after
# running, every DOCKER* chain and the *nat/*raw tables come out byte-for-
# byte identical, only INPUT and DOCKER-USER change.
#
# Two chains matter here, for different reasons:
#   - INPUT governs traffic addressed to the host itself (SSH). dockerd
#     never modifies INPUT, so it's safe to manage directly.
#   - DOCKER-USER governs traffic being forwarded to a published container
#     port. Docker guarantees this chain exists and is always the first
#     jump target in FORWARD, ahead of its own chains, specifically so a
#     host can filter published ports without fighting dockerd's own
#     iptables management — INPUT rules alone do NOT restrict
#     `docker run -p` / compose `ports:`. That first-jump guarantee is
#     stable across the chain restructuring mentioned above. Scoped to the
#     host's external interface (auto-detected below) so it can't
#     accidentally block container-to-container traffic on the docker
#     bridge network (e.g. frontend -> ipfs-node), which never arrives via
#     that interface.
#
# Usage: sudo ./iptables-rules.sh
# Persist across reboots (Debian/Ubuntu):
#   sudo apt install iptables-persistent && sudo netfilter-persistent save
# ...or call this script from a systemd unit / cron @reboot instead.
set -eu

TCP_PORTS="22 80 443 4001"
UDP_PORTS="4001"

# SSH connection-rate limit: past 4 new connections from one source within
# 60s, further attempts are dropped until the window rolls off. Slows down
# scripted brute-forcing without needing a separate tool (fail2ban etc.);
# raise/remove this if it ever gets in the way of legitimate use (e.g. a
# flaky client retrying fast).
SSH_RATE_SECONDS=60
SSH_RATE_HITS=4

EXT_IF=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
if [ -z "${EXT_IF:-}" ]; then
  echo "iptables-rules: could not detect the default network interface (no default route?) — aborting" >&2
  exit 1
fi

# --- INPUT: traffic addressed to this host directly -----------------------
iptables -F INPUT

iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
  -m recent --name sshbrute --set
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
  -m recent --name sshbrute --update --seconds "$SSH_RATE_SECONDS" --hitcount "$SSH_RATE_HITS" \
  -j DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

for port in $TCP_PORTS; do
  [ "$port" = 22 ] && continue # handled above with rate limiting
  iptables -A INPUT -p tcp --dport "$port" -j ACCEPT
done
for port in $UDP_PORTS; do
  iptables -A INPUT -p udp --dport "$port" -j ACCEPT
done

iptables -P INPUT DROP

# --- DOCKER-USER: traffic being forwarded to a published container port ---
iptables -N DOCKER-USER 2>/dev/null || true
iptables -F DOCKER-USER

iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

for port in $TCP_PORTS; do
  [ "$port" = 22 ] && continue # SSH is a host port, never docker-published
  iptables -A DOCKER-USER -i "$EXT_IF" -p tcp --dport "$port" -j ACCEPT
done
for port in $UDP_PORTS; do
  iptables -A DOCKER-USER -i "$EXT_IF" -p udp --dport "$port" -j ACCEPT
done

# Safety net: if a future `ports:` change ever exposes something new on
# 0.0.0.0, this blocks it from the outside by default instead of silently
# publishing it. Only matches traffic arriving via the external interface —
# container-to-container traffic on the docker bridge never hits this.
iptables -A DOCKER-USER -i "$EXT_IF" -j DROP

echo "iptables-rules: applied (external interface: $EXT_IF)"

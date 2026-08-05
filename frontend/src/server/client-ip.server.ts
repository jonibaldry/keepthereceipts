import { getRequestIP } from "@tanstack/react-start/server"

// Caddy is the only thing that ever talks to this app directly (see
// docker-compose.yml/Caddyfile), and it sets X-Forwarded-For on every
// proxied request, so it's safe to trust here.
export function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown"
}

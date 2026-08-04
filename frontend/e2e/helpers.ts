import { randomUUID } from "node:crypto"
import type { Page } from "@playwright/test"

// Forms are inert until React hydrates — a click before then falls through
// to native browser form submission (a real GET navigation with the fields
// as a query string), which looks like nothing happened. Waiting for
// network-idle after navigation gives the dev-mode module graph time to load
// and hydrate before the test starts interacting with the page.
export async function gotoAndHydrate(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.waitForLoadState("networkidle")
}

export interface TestCredentials {
  username: string
  email: string
  password: string
}

// A fresh, collision-free identity per test — tests run in parallel against
// one shared server/database, so reused usernames would trip the "already
// taken" conflict path unintentionally.
export function uniqueCredentials(): TestCredentials {
  const suffix = randomUUID().slice(0, 8)
  return {
    username: `e2e-${suffix}`,
    email: `e2e-${suffix}@example.com`,
    password: "correct-horse-battery",
  }
}

import { test, expect } from "@playwright/test"

test.describe("homepage", () => {
  test("renders the vault pitch and ledger", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /freely distributable document vault/i })).toBeVisible()
    await expect(page.getByText("CONTENT-ADDRESSED")).toBeVisible()
    await expect(page.getByText("REPLICATED")).toBeVisible()
    await expect(page.getByText("SELF-HOSTABLE")).toBeVisible()
    await expect(page.getByText("OPEN SOURCE", { exact: true })).toBeVisible()
    await expect(page.getByText("self-hosted · open source · no account required")).toBeVisible()
  })

  test("shows a logged-out nav by default", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "create account" })).toBeVisible()
    await expect(page.getByRole("link", { name: "log in" })).toBeVisible()
  })

  test("shows the current vault root status", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Current vault root")).toBeVisible()
    await expect(page.getByText(/VERIFIED|PENDING/)).toBeVisible()
  })
})

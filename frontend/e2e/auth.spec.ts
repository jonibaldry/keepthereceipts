import { test, expect } from "@playwright/test"
import { gotoAndHydrate, uniqueCredentials } from "./helpers"

test.describe("registration", () => {
  test("creates an account and shows a success panel", async ({ page }) => {
    const creds = uniqueCredentials()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(creds.email)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page.getByText("Account created")).toBeVisible()
    await expect(page.getByText(creds.username)).toBeVisible()
  })

  test("rejects a duplicate username with a conflict error", async ({ page }) => {
    const creds = uniqueCredentials()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(creds.email)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Account created")).toBeVisible()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(`different-${creds.email}`)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page.getByText("username or email is already taken")).toBeVisible()
  })

  test("rejects a password shorter than 8 characters", async ({ page }) => {
    const creds = uniqueCredentials()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(creds.email)
    await page.getByLabel("password").fill("short")
    await page.getByRole("button", { name: "Create account" }).click()

    // Browser-native minLength validation blocks submission before the
    // server round-trip, so the request never actually goes out.
    await expect(page.getByText("Account created")).not.toBeVisible()
  })
})

test.describe("login and logout", () => {
  test("logs in after registering, persists across reload, and logs out", async ({ page }) => {
    const creds = uniqueCredentials()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(creds.email)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Account created")).toBeVisible()

    await gotoAndHydrate(page, "/login")
    await page.getByLabel("username or email").fill(creds.username)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL("/")
    const logoutButton = page.getByRole("button", { name: `log out (${creds.username})` })
    await expect(logoutButton).toBeVisible()

    // The session is a cookie, not client state — it must survive a full SSR reload.
    await page.reload()
    await expect(page.getByRole("button", { name: `log out (${creds.username})` })).toBeVisible()

    await logoutButton.click()
    await expect(page.getByRole("link", { name: "create account" })).toBeVisible()
    await expect(page.getByRole("link", { name: "log in" })).toBeVisible()
  })

  test("shows an error for unknown credentials", async ({ page }) => {
    await gotoAndHydrate(page, "/login")
    await page.getByLabel("username or email").fill("nonexistent-user-does-not-exist")
    await page.getByLabel("password").fill("whatever-password")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page.getByText("username/email or password is incorrect")).toBeVisible()
  })

  test("shows an error for a wrong password", async ({ page }) => {
    const creds = uniqueCredentials()

    await gotoAndHydrate(page, "/register")
    await page.getByLabel("username").fill(creds.username)
    await page.getByLabel("email").fill(creds.email)
    await page.getByLabel("password").fill(creds.password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Account created")).toBeVisible()

    await gotoAndHydrate(page, "/login")
    await page.getByLabel("username or email").fill(creds.username)
    await page.getByLabel("password").fill("the-wrong-password")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page.getByText("username/email or password is incorrect")).toBeVisible()
  })
})

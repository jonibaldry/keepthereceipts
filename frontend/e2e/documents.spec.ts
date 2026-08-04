import { test, expect } from "@playwright/test"
import { gotoAndHydrate, uniqueCredentials, uniqueTitle } from "./helpers"

async function registerAndLogIn(page: import("@playwright/test").Page) {
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

  return creds
}

test.describe("adding a document", () => {
  test("redirects an anonymous visitor to log in", async ({ page }) => {
    await gotoAndHydrate(page, "/documents/new")
    await expect(page).toHaveURL("/login")
  })

  test("uploads a file, extracts hashtags, and shows the document in the vault", async ({ page }) => {
    await registerAndLogIn(page)
    const title = uniqueTitle("Electricity bill")

    await gotoAndHydrate(page, "/documents/new")
    await page.getByLabel("title").fill(title)
    await page.getByLabel("description").fill("Paid via #directdebit #utilities")
    await page.setInputFiles('input[name="file"]', {
      name: "bill.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not really a pdf, just an e2e fixture"),
    })
    await page.getByRole("button", { name: "Add to vault" }).click()

    await expect(page.getByText("Document added")).toBeVisible()
    await expect(page.getByText(title)).toBeVisible()

    await page.getByRole("link", { name: "View it" }).click()
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(page.getByText("bill.txt")).toBeVisible()
    await expect(page.getByText("#directdebit #utilities", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Download from the gateway" })).toBeVisible()

    await gotoAndHydrate(page, "/documents")
    await expect(page.getByRole("link", { name: title })).toBeVisible()
  })

  test("creates a document with no file and no source URL", async ({ page }) => {
    await registerAndLogIn(page)
    const title = uniqueTitle("Just a note")

    await gotoAndHydrate(page, "/documents/new")
    await page.getByLabel("title").fill(title)
    await page.getByLabel("description").fill("no attachments, just a #note")
    await page.getByRole("button", { name: "Add to vault" }).click()

    await expect(page.getByText("Document added")).toBeVisible()

    await page.getByRole("link", { name: "View it" }).click()
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(page.getByText("File", { exact: true })).not.toBeVisible()
    await expect(page.getByText("Source", { exact: true })).not.toBeVisible()
  })

  test("rejects an empty title via server-side validation", async ({ page }) => {
    await registerAndLogIn(page)

    await gotoAndHydrate(page, "/documents/new")
    // Browser-native `required` blocks the empty title client-side, so
    // submit a title of just whitespace to reach the server validator.
    await page.getByLabel("title").fill("   ")
    await page.setInputFiles('input[name="file"]', {
      name: "bill.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("fixture"),
    })
    await page.getByRole("button", { name: "Add to vault" }).click()

    await expect(page.getByText("title is required")).toBeVisible()
  })
})

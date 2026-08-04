import { chromium } from "playwright-core"
import { addBytesToIpfs, mfsCp, mfsMkdirP } from "./ipfs.server"
import { updateAttachment } from "./documents-db.server"

const CAPTURE_TIMEOUT_MS = 20_000

interface CaptureResult {
  screenshot: Buffer
  archive: Buffer
}

async function capturePageArtifacts(url: string): Promise<CaptureResult> {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(url, { waitUntil: "networkidle", timeout: CAPTURE_TIMEOUT_MS })

    const screenshot = await page.screenshot({ fullPage: true, timeout: CAPTURE_TIMEOUT_MS })

    // MHTML inlines every subresource (CSS, images, fonts) into one file,
    // so the archive is viewable offline without re-fetching the source
    // site — a raw page.content() dump would lose all of that.
    const cdp = await page.context().newCDPSession(page)
    const { data } = await cdp.send("Page.captureSnapshot", { format: "mhtml" })

    return { screenshot, archive: Buffer.from(data, "utf-8") }
  } finally {
    await browser.close()
  }
}

// Runs after the screenshot/archive attachment rows already exist (status
// 'pending'). Never throws — the create-document flow fires this without
// awaiting it, so failures can only be observed via each attachment's
// status column, not a promise rejection.
export async function captureAndStore(
  documentId: string,
  sourceUrl: string,
  screenshotAttachmentId: string,
  archiveAttachmentId: string,
): Promise<void> {
  let artifacts: CaptureResult
  try {
    artifacts = await capturePageArtifacts(sourceUrl)
  } catch (err) {
    console.error(`capture failed for document ${documentId}:`, err)
    updateAttachment(screenshotAttachmentId, { status: "failed" })
    updateAttachment(archiveAttachmentId, { status: "failed" })
    return
  }

  const mfsDir = `/document/${documentId}`
  await mfsMkdirP(mfsDir)

  try {
    const { cid, size } = await addBytesToIpfs(artifacts.screenshot, "screenshot.png")
    await mfsCp(cid, `${mfsDir}/screenshot.png`)
    updateAttachment(screenshotAttachmentId, { cid, fileSize: size, status: "complete" })
  } catch (err) {
    console.error(`screenshot storage failed for document ${documentId}:`, err)
    updateAttachment(screenshotAttachmentId, { status: "failed" })
  }

  try {
    const { cid, size } = await addBytesToIpfs(artifacts.archive, "archive.mhtml")
    await mfsCp(cid, `${mfsDir}/archive.mhtml`)
    updateAttachment(archiveAttachmentId, { cid, fileSize: size, status: "complete" })
  } catch (err) {
    console.error(`archive storage failed for document ${documentId}:`, err)
    updateAttachment(archiveAttachmentId, { status: "failed" })
  }
}

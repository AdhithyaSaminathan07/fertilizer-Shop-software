import { spawn } from "child_process";
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACT_DIR = "C:/Users/Adhithya/.gemini/antigravity/brain/095fd9a8-07c4-401a-8d38-25c4e3f2dce4";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok || res.status === 200 || res.status === 401) {
        return true;
      }
    } catch {
      // wait and retry
    }
    await wait(1000);
  }
  return false;
}

async function main() {
  console.log(`Starting Next.js server on port ${PORT}...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });

  try {
    const ready = await waitForServer(BASE_URL);
    if (!ready) {
      console.error("Server failed to respond within timeout.");
      process.exit(1);
    }
    console.log("Server is ready. Launching headless Chrome...");

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Set bypass session cookie so middleware permits UI routes
    await page.setCookie({
      name: "kasi_session",
      value: "dev_preview_session_token",
      domain: "localhost",
      path: "/",
    });

    // 1. Mobile View - /products/new (375 x 812)
    console.log("Capturing Mobile /products/new...");
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/products/new`, { waitUntil: "domcontentloaded" });
    await wait(2000);
    const mobileNewPath = path.join(ARTIFACT_DIR, "phase4-product-new-mobile.png");
    await page.screenshot({ path: mobileNewPath, fullPage: false });
    console.log(`Saved: ${mobileNewPath}`);

    // 1b. Mobile View Full Form Scroll - /products/new
    const mobileNewFullPath = path.join(ARTIFACT_DIR, "phase4-product-new-mobile-full.png");
    await page.screenshot({ path: mobileNewFullPath, fullPage: true });
    console.log(`Saved: ${mobileNewFullPath}`);

    // 2. Tablet View - /products/new (768 x 1024)
    console.log("Capturing Tablet /products/new...");
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 2, isMobile: false });
    await page.goto(`${BASE_URL}/products/new`, { waitUntil: "domcontentloaded" });
    await wait(2000);
    const tabletNewPath = path.join(ARTIFACT_DIR, "phase4-product-new-tablet.png");
    await page.screenshot({ path: tabletNewPath, fullPage: false });
    console.log(`Saved: ${tabletNewPath}`);

    // 3. Desktop View - /products/new (1280 x 800)
    console.log("Capturing Desktop /products/new...");
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2, isMobile: false });
    await page.goto(`${BASE_URL}/products/new`, { waitUntil: "domcontentloaded" });
    await wait(2000);
    const desktopNewPath = path.join(ARTIFACT_DIR, "phase4-product-new-desktop.png");
    await page.screenshot({ path: desktopNewPath, fullPage: false });
    console.log(`Saved: ${desktopNewPath}`);

    // 4. Desktop View - /products (1280 x 800)
    console.log("Capturing Desktop /products Catalog...");
    await page.goto(`${BASE_URL}/products`, { waitUntil: "domcontentloaded" });
    await wait(2000);
    const desktopCatalogPath = path.join(ARTIFACT_DIR, "phase4-products-catalog-desktop.png");
    await page.screenshot({ path: desktopCatalogPath, fullPage: false });
    console.log(`Saved: ${desktopCatalogPath}`);

    // 5. Mobile View - /categories (375 x 812)
    console.log("Capturing Mobile /categories...");
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/categories`, { waitUntil: "domcontentloaded" });
    await wait(2000);
    const mobileCatPath = path.join(ARTIFACT_DIR, "phase4-categories-mobile.png");
    await page.screenshot({ path: mobileCatPath, fullPage: false });
    console.log(`Saved: ${mobileCatPath}`);

    await browser.close();
    console.log("All screenshots captured successfully.");
  } finally {
    console.log("Terminating server...");
    server.kill("SIGTERM");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", server.pid, "/f", "/t"]);
    }
  }
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});

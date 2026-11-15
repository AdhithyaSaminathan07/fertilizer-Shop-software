import { spawn } from "child_process";
import puppeteer from "puppeteer-core";
import path from "path";

const PORT = 3014;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:/Users/Adhithya/.gemini/antigravity/brain/095fd9a8-07c4-401a-8d38-25c4e3f2dce4";

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
      // retry
    }
    await wait(1000);
  }
  return false;
}

let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedChecks++;
  }
}

async function runScrollVerification() {
  console.log("==========================================================");
  console.log("  KASI AGRI AGENCIES - SCROLL & SIDEBAR VERIFICATION SUITE");
  console.log("==========================================================");

  console.log(`[Setup] Starting Next.js server on port ${PORT}...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });

  let browser;

  try {
    const ready = await waitForServer(BASE_URL);
    if (!ready) {
      console.error("Server failed to respond within timeout.");
      process.exit(1);
    }
    console.log("[Setup] Server online. Launching Chrome...");

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Authenticate session cookie
    await page.setCookie({
      name: "kasi_session",
      value: "dev_preview_session_token",
      domain: "localhost",
      path: "/",
    });

    // ==========================================
    // TEST GROUP 1: DESKTOP FIXED SIDEBAR (1280x800)
    // ==========================================
    console.log("\n--- TEST GROUP 1: DESKTOP FIXED SIDEBAR & INDEPENDENT SCROLLING ---");
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await wait(1500);

    const desktopChecks = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      const main = document.querySelector("main");
      const header = document.querySelector("header");

      if (!sidebar || !main || !header) {
        return { error: "Missing sidebar, main or header elements" };
      }

      const sidebarStyle = window.getComputedStyle(sidebar);
      const sidebarRect = sidebar.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();

      // Scroll the main content down by 600px
      const initialScrollTop = main.scrollTop;
      main.scrollTop = 600;
      const scrolledTop = main.scrollTop;

      // Re-measure after scroll
      const sidebarRectAfterScroll = sidebar.getBoundingClientRect();
      const headerRectAfterScroll = header.getBoundingClientRect();

      return {
        sidebarPosition: sidebarStyle.position,
        sidebarHeight: sidebarRect.height,
        windowHeight: window.innerHeight,
        sidebarTopBefore: sidebarRect.top,
        sidebarTopAfter: sidebarRectAfterScroll.top,
        headerTopBefore: headerRect.top,
        headerTopAfter: headerRectAfterScroll.top,
        mainLeft: mainRect.left,
        sidebarWidth: sidebarRect.width,
        mainScrollsIndependently: scrolledTop > initialScrollTop || main.scrollHeight > main.clientHeight,
        hasHorizontalOverflow: main.scrollWidth > main.clientWidth,
      };
    });

    assert(desktopChecks.sidebarPosition === "fixed", "1.1 Desktop sidebar is position: fixed");
    assert(Math.abs(desktopChecks.sidebarHeight - desktopChecks.windowHeight) <= 2, "1.2 Desktop sidebar occupies full viewport height (100vh / 100dvh)");
    assert(desktopChecks.sidebarTopBefore === 0 && desktopChecks.sidebarTopAfter === 0, "1.3 Sidebar does not move when main content scrolls (top stays at 0px)");
    assert(desktopChecks.headerTopBefore === 0 && desktopChecks.headerTopAfter === 0, "1.4 Top navigation remains fixed at the top of the viewport");
    assert(desktopChecks.mainLeft >= desktopChecks.sidebarWidth - 1, "1.5 Main content has correct left offset and never overlaps the sidebar");
    assert(!desktopChecks.hasHorizontalOverflow, "1.6 No horizontal overflow in main viewport");

    // Capture desktop scroll verification screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, "phase4-desktop-fixed-sidebar.png");
    await page.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log(`  Saved screenshot: ${desktopScreenshotPath}`);

    // ==========================================
    // TEST GROUP 2: MOBILE FIXED DRAWER & SCROLL LOCK (375x812)
    // ==========================================
    console.log("\n--- TEST GROUP 2: MOBILE DRAWER, BACKDROP & BODY SCROLL LOCK ---");
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/products`, { waitUntil: "domcontentloaded" });
    await wait(1500);

    const mobileInitial = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      const menuButton = document.querySelector('header button[aria-label="Open navigation menu"]');
      const bodyOverflowInitial = window.getComputedStyle(document.body).overflow;

      return {
        sidebarHidden: !sidebar || window.getComputedStyle(sidebar).display === "none",
        hasMenuButton: !!menuButton,
        bodyOverflowInitial,
      };
    });

    assert(mobileInitial.sidebarHidden, "2.1 Desktop sidebar is hidden on mobile viewport (<1024px)");
    assert(mobileInitial.hasMenuButton, "2.2 Mobile drawer menu button is present in TopNav");

    // Click menu button to open drawer
    await page.click('header button[aria-label="Open navigation menu"]');
    await wait(600); // allow spring animation

    const mobileOpenChecks = await page.evaluate(() => {
      const drawer = document.querySelector('div[aria-label="Close navigation menu"]')?.closest('.fixed') ||
                     document.querySelector('div.fixed.inset-y-0.left-0');
      const backdrop = document.querySelector('div.bg-slate-900\\/60');
      const bodyOverflow = document.body.style.overflow;
      const bodyTouchAction = document.body.style.touchAction;

      return {
        hasDrawer: !!drawer,
        hasBackdrop: !!backdrop,
        bodyOverflowLocked: bodyOverflow === "hidden",
        bodyTouchActionLocked: bodyTouchAction === "none",
      };
    });

    assert(mobileOpenChecks.hasDrawer, "2.3 Mobile drawer slides in with fixed positioning");
    assert(mobileOpenChecks.hasBackdrop, "2.4 Backdrop overlay renders behind the drawer");
    assert(mobileOpenChecks.bodyOverflowLocked, "2.5 Background body scrolling is strictly locked while drawer is open");

    // Capture mobile drawer open screenshot
    const mobileDrawerScreenshotPath = path.join(ARTIFACT_DIR, "phase4-mobile-drawer-open.png");
    await page.screenshot({ path: mobileDrawerScreenshotPath, fullPage: false });
    console.log(`  Saved screenshot: ${mobileDrawerScreenshotPath}`);

    // Click "Categories" link inside the drawer to test navigation dismissal
    await page.evaluate(() => {
      const link = document.querySelector('div.fixed a[href="/categories"]');
      if (link) link.click();
    });
    await wait(1200);

    const afterNavigation = await page.evaluate(() => {
      return {
        currentUrl: window.location.pathname,
        bodyOverflowRestored: document.body.style.overflow !== "hidden",
      };
    });

    assert(afterNavigation.currentUrl === "/categories", "2.6 Selecting drawer item navigates to destination page");
    assert(afterNavigation.bodyOverflowRestored, "2.7 Background scroll lock is released after drawer closes");

    // ==========================================
    // TEST GROUP 3: TABLET RESPONSIVENESS (768x1024)
    // ==========================================
    console.log("\n--- TEST GROUP 3: TABLET RESPONSIVENESS (768x1024) ---");
    await page.setViewport({ width: 768, height: 1024, isMobile: false });
    await page.goto(`${BASE_URL}/employees`, { waitUntil: "domcontentloaded" });
    await wait(1500);

    const tabletChecks = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      const main = document.querySelector("main");
      const header = document.querySelector("header");

      return {
        sidebarHidden: !sidebar || window.getComputedStyle(sidebar).display === "none",
        hasHeader: !!header,
        mainWidth: main ? main.clientWidth : 0,
        hasHorizontalOverflow: main ? main.scrollWidth > main.clientWidth : false,
      };
    });

    assert(tabletChecks.sidebarHidden, "3.1 Tablet viewport (<1024px) cleanly utilizes mobile navigation drawer");
    assert(tabletChecks.hasHeader && !tabletChecks.hasHorizontalOverflow, "3.2 Tablet layout adapts smoothly without horizontal overflow");

    const tabletScreenshotPath = path.join(ARTIFACT_DIR, "phase4-tablet-employees-scrolling.png");
    await page.screenshot({ path: tabletScreenshotPath, fullPage: false });
    console.log(`  Saved screenshot: ${tabletScreenshotPath}`);

    console.log("\n==========================================================");
    console.log(`SCROLL VERIFICATION: ${passedChecks} PASSED, ${failedChecks} FAILED`);
    console.log("==========================================================");

    if (failedChecks > 0) {
      process.exit(1);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log("[Teardown] Shutting down Next.js server...");
    server.kill("SIGTERM");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", server.pid, "/f", "/t"]);
    }
  }
}

runScrollVerification().catch((err) => {
  console.error("Scroll verification error:", err);
  process.exit(1);
});

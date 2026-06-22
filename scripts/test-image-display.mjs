#!/usr/bin/env node
/**
 * Browser test: 컴활2급 정기 3회 Q21/Q22 image display on GitHub Pages
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://teacherjiu-coder.github.io/";
const OUT_DIR = join(process.cwd(), "test-screenshots");

async function inspectQuestion(page, qNum, label) {
  const navBtn = page.locator(`.q-nav-btn`).filter({ hasText: String(qNum) });
  await navBtn.click();
  await page.waitForTimeout(800);

  const result = await page.evaluate((q) => {
    const wrap = document.querySelector("#question-image-wrap");
    const imgs = wrap ? [...wrap.querySelectorAll("img")] : [];
    const optionImgs = [...document.querySelectorAll("#options img")];
    const allImgs = [...imgs, ...optionImgs];

    const imgDetails = allImgs.map((img) => {
      const rect = img.getBoundingClientRect();
      const style = getComputedStyle(img);
      return {
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
      };
    });

    return {
      qNumber: document.querySelector("#q-number")?.textContent?.trim(),
      wrapHidden: wrap?.classList.contains("hidden") ?? true,
      wrapAriaHidden: wrap?.getAttribute("aria-hidden"),
      wrapEmpty: !wrap?.innerHTML?.trim(),
      questionImgCount: imgs.length,
      optionImgCount: optionImgs.length,
      images: imgDetails,
    };
  }, qNum);

  const screenshotPath = join(OUT_DIR, `${label}-q${qNum}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return { ...result, screenshotPath };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const consoleLogs = [];
  const consoleErrors = [];
  const failedRequests = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on("console", (msg) => {
    const entry = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(entry);
    if (msg.type() === "error") consoleErrors.push(entry);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      failure: req.failure()?.errorText,
    });
  });

  console.log("1. Navigating to", BASE);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: join(OUT_DIR, "01-home.png") });

  console.log("2. Click 컴활 2급");
  await page.locator('.grade-card[data-grade="2"]').click();
  await page.waitForSelector("#jeonggi-grid", { state: "visible" });
  await page.screenshot({ path: join(OUT_DIR, "02-round-select.png") });

  console.log("3. Click 정기 3회");
  await page.locator("#jeonggi-grid button").filter({ hasText: "3회" }).click();
  await page.waitForSelector('[data-mode="normal"]', { state: "visible" });
  await page.screenshot({ path: join(OUT_DIR, "03-mode-panel.png") });

  console.log("4. Start 일반 풀이");
  await page.locator('[data-mode="normal"]').click();
  await page.waitForSelector("#quiz-screen.active", { timeout: 30000 });
  await page.waitForSelector(".q-nav-btn", { state: "visible" });
  await page.screenshot({ path: join(OUT_DIR, "04-quiz-start.png") });

  console.log("5. Navigate to Q22");
  const q22 = await inspectQuestion(page, 22, "q22");
  console.log("6. Navigate to Q21");
  const q21 = await inspectQuestion(page, 21, "q21");

  // Check image URLs directly
  const urlChecks = [];
  const allSrcs = [
    ...q21.images.map((i) => i.src),
    ...q22.images.map((i) => i.src),
  ];
  for (const url of [...new Set(allSrcs)]) {
    if (!url) continue;
    try {
      const resp = await page.request.get(url);
      urlChecks.push({ url, status: resp.status(), ok: resp.ok() });
    } catch (e) {
      urlChecks.push({ url, status: null, ok: false, error: e.message });
    }
  }

  await browser.close();

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE,
    questions: { q21, q22 },
    urlChecks,
    consoleErrors,
    consoleLogs: consoleLogs.slice(-30),
    failedRequests: failedRequests.filter((r) =>
      /\.(png|jpg|jpeg|webp|gif)/i.test(r.url) || r.url.includes("/img/")
    ),
    screenshotDir: OUT_DIR,
  };

  console.log("\n=== REPORT ===\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

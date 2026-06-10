import { chromium } from "playwright";

const DEFAULT_URLS = [
  "https://hakwonplus.com/promo",
  "https://limglish.kr/login",
  "https://tchul.com/login",
  "https://ymath.co.kr/login",
  "https://sswe.co.kr/login",
  "https://dnbacademy.co.kr/login",
];

const viewports = [
  { name: "desktop", width: 1366, height: 768, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const urls = (process.env.TENANT_AVAILABILITY_URLS || DEFAULT_URLS.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const maxAttempts = Number(process.env.TENANT_AVAILABILITY_ATTEMPTS || 2);

const maintenancePatterns = [
  /업데이트\s*반영중/,
  /maintenance/i,
];

function isMaintenance({ url, text }) {
  return url.includes("/maintenance") || maintenancePatterns.some((pattern) => pattern.test(text));
}

function summarizeText(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function isSameOrigin(targetUrl, origin) {
  try {
    return new URL(targetUrl).origin === origin;
  } catch {
    return false;
  }
}

async function checkUrl(browser, rawUrl, viewport, attempt) {
  const targetUrl = rawUrl.replace(/\/+$/, "");
  const targetOrigin = new URL(targetUrl).origin;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
  });
  const page = await context.newPage();
  const issues = [];

  page.on("requestfailed", (request) => {
    if (request.resourceType() !== "document" && !isSameOrigin(request.url(), targetOrigin)) return;

    issues.push({
      type: "requestfailed",
      url: request.url(),
      failure: request.failure()?.errorText || "",
    });
  });
  page.on("response", (response) => {
    if (!isSameOrigin(response.url(), targetOrigin) || response.status() < 500) return;
    issues.push({ type: "http", url: response.url(), status: response.status() });
  });

  let status = 0;
  let navigationError = "";
  try {
    const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    status = response?.status() || 0;
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const finalUrl = page.url();
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const text = summarizeText(bodyText);
  const maintenance = isMaintenance({ url: finalUrl, text: bodyText });
  const ok = !navigationError && status > 0 && status < 500 && !maintenance && issues.length === 0 && text.length > 0;

  await context.close();

  return {
    url: targetUrl,
    viewport: viewport.name,
    attempt,
    ok,
    status,
    finalUrl,
    title,
    maintenance,
    navigationError,
    issues,
    text,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

try {
  for (const rawUrl of urls) {
    for (const viewport of viewports) {
      let result;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        result = await checkUrl(browser, rawUrl, viewport, attempt);
        if (result.ok) break;
      }

      if (!result.ok) failed = true;
      results.push(result);
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));

if (failed) {
  console.error("Tenant availability verification failed.");
  process.exit(1);
}

console.log("Tenant availability verification passed.");

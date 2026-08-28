import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const baseUrl = (process.env.PROMO_CAPTURE_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const tenantCode = (process.env.PROMO_CAPTURE_TENANT || "").trim();
const password = (process.env.PROMO_CAPTURE_PASSWORD || "").trim();
const teacherUsername = (process.env.PROMO_CAPTURE_TEACHER || "ymath-qa-teacher").trim();
const studentUsername = (process.env.PROMO_CAPTURE_STUDENT || "ymath-qa-student-01").trim();
const lectureId = Number(process.env.PROMO_CAPTURE_LECTURE_ID || 0);
const sessionId = Number(process.env.PROMO_CAPTURE_SESSION_ID || 0);
const outputDir = resolve(process.cwd(), "public", "promo");

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl)) {
  throw new Error("Promo real-use capture only accepts a loopback frontend origin.");
}
if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(tenantCode)) {
  throw new Error("PROMO_CAPTURE_TENANT must identify an isolated qa-ymath-realuse tenant.");
}
if (!password) {
  throw new Error("PROMO_CAPTURE_PASSWORD is required.");
}
if (!Number.isInteger(lectureId) || lectureId <= 0 || !Number.isInteger(sessionId) || sessionId <= 0) {
  throw new Error("PROMO_CAPTURE_LECTURE_ID and PROMO_CAPTURE_SESSION_ID must be positive integers.");
}

async function login(page, username, destinationPattern) {
  await page.goto(`${baseUrl}/login/${tenantCode}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(destinationPattern, { timeout: 45_000 });
}

async function dismissFirstLoginGuide(page) {
  const guide = page.locator("[data-first-login-tenant]");
  if (!await guide.isVisible({ timeout: 12_000 }).catch(() => false)) return;
  await guide.locator('[aria-label="계정 안내 닫기"]').click();
  await guide.waitFor({ state: "hidden", timeout: 10_000 });
}

async function settle(page, locator) {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
}

const browser = await chromium.launch({ headless: true });
try {
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "ko-KR",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const adminPage = await adminContext.newPage();
  await login(adminPage, teacherUsername, /\/workspace(?:\/|$)/);
  await adminPage.goto(`${baseUrl}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
  await dismissFirstLoginGuide(adminPage);
  await settle(adminPage, adminPage.getByRole("heading", { name: "오늘 처리할 일" }));
  await dismissFirstLoginGuide(adminPage);
  await adminPage.screenshot({
    path: resolve(outputDir, "admin-operations-realuse-20260828.png"),
    fullPage: false,
  });

  await adminPage.goto(
    `${baseUrl}/workspace/lectures/${lectureId}/sessions/${sessionId}/attendance`,
    { waitUntil: "domcontentloaded" },
  );
  await settle(adminPage, adminPage.getByText("김가람", { exact: true }));
  await adminPage.screenshot({
    path: resolve(outputDir, "admin-attendance-realuse-20260828.png"),
    fullPage: false,
  });
  await adminContext.close();

  const studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const studentPage = await studentContext.newPage();
  await login(studentPage, studentUsername, /\/student(?:\/|$)/);
  await studentPage.goto(`${baseUrl}/student/dashboard`, { waitUntil: "domcontentloaded" });
  await dismissFirstLoginGuide(studentPage);
  await settle(studentPage, studentPage.locator(".student-layout"));
  await dismissFirstLoginGuide(studentPage);
  const studentBody = await studentPage.locator("body").innerText();
  if (!studentBody.includes("오늘 할 일") || studentBody.includes("페이지를 불러오지 못했습니다")) {
    throw new Error("Student dashboard did not reach its usable real-data state.");
  }
  await studentPage.locator(".student-layout").screenshot({
    path: resolve(outputDir, "student-operations-realuse-20260828.png"),
  });
  await studentContext.close();
} finally {
  await browser.close();
}

console.log("격리 개발 데이터 기반 프로모션 화면 3장을 저장했습니다.");

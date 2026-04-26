/**
 * One-shot UIUX smoke for 강의-차시-시험/과제 changes (2026-04-27).
 *
 * Loads:
 *   - admin /admin/lectures (then drills into first lecture → first session → exams/assignments)
 *   - admin /teacher/exams (admin가 teacher 라우트 진입; 권한 충족 시)
 *   - student /student/sessions (then first session detail)
 *
 * Asserts: no page-level JS errors, and screenshots saved to test-results/.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test-results");
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOCAL = process.env.LOCAL_BASE || "http://localhost:5174";
const API = process.env.API_BASE || "https://api.hakwonplus.com";

const ADMIN = {
  user: process.env.E2E_ADMIN_USER || "admin97",
  pass: process.env.E2E_ADMIN_PASS || "koreaseoul97",
  code: "hakwonplus",
};
const STUDENT = {
  user: process.env.E2E_STUDENT_USER || "3333",
  pass: process.env.E2E_STUDENT_PASS || "test1234",
  code: "hakwonplus",
};

async function loginAndInjectToken(page, who) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: who.user, password: who.pass, tenant_code: who.code },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": who.code },
    timeout: 60_000,
  });
  if (!resp.ok()) {
    throw new Error(`Login failed (${resp.status()}): ${await resp.text()}`);
  }
  const json = await resp.json();
  // Inject tokens into localStorage for the dev origin
  await page.goto(LOCAL);
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch { /* ignore */ }
  }, { access: json.access, refresh: json.refresh ?? null, code: who.code });
}

function watchPageErrors(page, label) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(`[${label}] pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${label}] console.error: ${msg.text()}`);
  });
  return errors;
}

async function snap(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

async function runAdmin(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = watchPageErrors(page, "admin");
  await loginAndInjectToken(page, ADMIN);

  console.log("→ admin /admin/lectures");
  await page.goto(`${LOCAL}/admin/lectures`, { waitUntil: "networkidle" });
  await snap(page, "01-admin-lectures");

  // Find a lecture id from the rendered DOM. Lectures are rendered in a table; the "차시" gear or
  // row click navigates to /admin/lectures/{id}. We probe via API instead to avoid selector fragility.
  const lectureResp = await page.request.get(`${API}/api/v1/lectures/lectures/?page_size=5`, {
    headers: {
      Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("access"))}`,
      "X-Tenant-Code": ADMIN.code,
    },
  });
  if (!lectureResp.ok()) {
    console.log(`  lecture API ${lectureResp.status()}: ${(await lectureResp.text()).slice(0, 200)}`);
  }
  const lectures = lectureResp.ok() ? (await lectureResp.json()) : null;
  const lectureList = Array.isArray(lectures) ? lectures : (lectures?.results ?? []);
  if (lectures) console.log(`  lectures fetched: ${lectureList.length}`);
  const lectureId = lectureList[0]?.id;
  if (!lectureId) {
    console.log("  (no lectures via API)");
  } else {
    console.log(`  → lecture ${lectureId}`);

    await page.goto(`${LOCAL}/admin/lectures/${lectureId}/sessions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await snap(page, "02-admin-lecture-sessions");

    // Get first session id via API
    const sessResp = await page.request.get(`${API}/api/v1/lectures/sessions/?lecture=${lectureId}&page_size=5`, {
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("access"))}`,
        "X-Tenant-Code": ADMIN.code,
      },
    });
    const sessions = sessResp.ok() ? await sessResp.json() : null;
    const sessionList = Array.isArray(sessions) ? sessions : (sessions?.results ?? []);
    const sessionId = sessionList[0]?.id;
    if (!sessionId) {
      console.log("  (no sessions via API)");
    } else {
      console.log(`  → session ${sessionId}`);
      const sessionPath = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

      await page.goto(`${LOCAL}${sessionPath}/exams`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200); // allow exam summary fetch
      await snap(page, "03-admin-session-exams");

      await page.goto(`${LOCAL}${sessionPath}/assignments`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await snap(page, "04-admin-session-assignments");
    }
  }

  console.log("→ admin /teacher/exams");
  await page.goto(`${LOCAL}/teacher/exams`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await snap(page, "05-teacher-exams-tab");

  // Click 과제 tab
  const homeworkTab = page.getByRole("button", { name: "과제", exact: true }).first();
  if (await homeworkTab.count() > 0) {
    await homeworkTab.click();
    await page.waitForTimeout(500);
    await snap(page, "06-teacher-homeworks-tab");
  }

  await ctx.close();
  return errs;
}

async function runStudent(browser) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = watchPageErrors(page, "student");
  await loginAndInjectToken(page, STUDENT);

  console.log("→ student /student/sessions");
  await page.goto(`${LOCAL}/student/sessions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await snap(page, "10-student-sessions-list");

  // Navigate via API to find first student session
  const sessionResp = await page.request.get(`${API}/api/v1/student/sessions/me/`, {
    headers: {
      Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("access"))}`,
      "X-Tenant-Code": STUDENT.code,
    },
  });
  const data = sessionResp.ok() ? await sessionResp.json() : null;
  const list = Array.isArray(data) ? data : (data?.items ?? []);
  const sessionId = list[0]?.id;
  if (sessionId) {
    console.log(`  → student session ${sessionId}`);
    await page.goto(`${LOCAL}/student/sessions/${sessionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await snap(page, "11-student-session-detail");
  } else {
    console.log("  (no student sessions via API)");
  }

  await ctx.close();
  return errs;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const allErrors = [];
  try {
    const a = await runAdmin(browser);
    allErrors.push(...a);
    const s = await runStudent(browser);
    allErrors.push(...s);
  } finally {
    await browser.close();
  }
  if (allErrors.length > 0) {
    console.error("\n❌ Page errors detected:");
    for (const e of allErrors) console.error(" - " + e);
    process.exit(1);
  } else {
    console.log("\n✅ No page-level errors. Smoke pass.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

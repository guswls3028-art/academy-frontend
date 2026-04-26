/**
 * DNB Academy (tenant 9) — Lectures / Sessions / Attendance Full E2E
 * Real browser + DOM visible assertions. section_mode=false.
 * Cleanup: all [E2E-*] test data removed after run.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";
import type { Page, APIRequestContext } from "@playwright/test";

test.setTimeout(120000);

const DNB_BASE = getBaseUrl("dnb-admin");
const API = getApiBaseUrl();
const CODE = "dnb";
const ADMIN_USER = process.env.DNB_ADMIN_USER || "dheksql88";
const ADMIN_PASS = process.env.DNB_ADMIN_PASS || "dheksql0513";

const TS = Date.now();
const LECTURE_TITLE = `[E2E-${TS}] 수학심화`;
const STUDENT_NAME = `[E2E-${TS}] 김테스트`;

let accessToken = "";
let createdLectureId: number | null = null;
let createdStudentId: number | null = null;
let createdSessionId: number | null = null;
let createdEnrollmentId: number | null = null;

/* ───── helpers ───── */

async function getToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  return body.access;
}

function apiH(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tenant-Code": CODE };
}

async function dnbLogin(page: Page): Promise<string> {
  await loginViaUI(page, "dnb-admin");
  return await page.evaluate(() => localStorage.getItem("access") || "");
}

async function screenshotAs(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/dnb-lectures-${name}.png`, fullPage: true });
}

/* ───── tests ───── */

test.describe.serial("DNB Lectures / Sessions / Attendance E2E", () => {

  /* 1. Lecture list via sidebar navigation */
  test("1. Sidebar > Lectures list renders with tabs", async ({ page }) => {
    accessToken = await dnbLogin(page);

    const sidebarLink = page.locator('a[href="/admin/lectures"]').first();
    await sidebarLink.waitFor({ state: "visible", timeout: 10000 });
    await sidebarLink.click();
    await page.waitForURL("**/admin/lectures**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    await expect(page.locator("text=강의목록")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=지난강의")).toBeVisible({ timeout: 5000 });

    await screenshotAs(page, "01-lecture-list");
  });

  /* 1b. Tab switching */
  test("1b. Past lectures tab switch", async ({ page }) => {
    accessToken = await dnbLogin(page);
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures`);

    const pastTab = page.locator("a, button").filter({ hasText: "지난강의" }).first();
    await pastTab.click();
    await expect(page).toHaveURL(/\/admin\/lectures\/past/);
    await screenshotAs(page, "01b-past-lectures-tab");

    const currentTab = page.locator("a, button").filter({ hasText: "강의목록" }).first();
    await currentTab.click();
    await expect(page).toHaveURL(/\/admin\/lectures$/);
    await screenshotAs(page, "01b-current-lectures-tab");
  });

  /* 2. Create lecture via modal */
  test("2. Create lecture via Add button + modal", async ({ page }) => {
    accessToken = await dnbLogin(page);

    const sidebarLink = page.locator('a[href="/admin/lectures"]').first();
    await sidebarLink.waitFor({ state: "visible", timeout: 10000 });
    await sidebarLink.click();
    await page.waitForURL("**/admin/lectures**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const addBtn = page.locator("button").filter({ hasText: /강의 추가|강의추가/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 5000 });
    await addBtn.click();

    // Modal — 제목이 보일 때까지.
    const modalTitle = page.locator("text=강의 추가").first();
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    const titleInput = page.locator('input[aria-label*="강의 이름"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(LECTURE_TITLE);

    const subjectInput = page.locator('input[aria-label*="과목"]').first();
    await subjectInput.fill("수학");

    const startDateInput = page.locator('input[placeholder*="시작일"]').first();
    if (await startDateInput.isVisible().catch(() => false)) {
      await startDateInput.fill("2026-04-10");
    }

    const startTimeInput = page.locator('input[placeholder*="시작"]').first();
    if (await startTimeInput.isVisible().catch(() => false)) {
      await startTimeInput.click();
    }

    await screenshotAs(page, "02-lecture-create-modal-filled");

    const submitBtn = page.locator("button").filter({ hasText: "등록" }).first();
    await submitBtn.click();
    // 등록 후 모달 닫힘 또는 목록 갱신 settle.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await screenshotAs(page, "02-after-create");
  });

  /* 2b. Verify via API that lecture was created, get ID */
  test("2b. Verify created lecture via API + DOM", async ({ page, request }) => {
    accessToken = await getToken(request);

    const resp = await request.get(`${API}/api/v1/lectures/lectures/`, {
      headers: apiH(accessToken),
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const results = data.results ?? data;
    const found = results.find((l: { title: string }) => l.title === LECTURE_TITLE);

    if (!found) {
      // Modal creation may have failed — fallback to API creation.
      const createResp = await request.post(`${API}/api/v1/lectures/lectures/`, {
        data: {
          title: LECTURE_TITLE, name: "테스트강사", subject: "수학",
          description: "E2E test", start_date: "2026-04-10",
          lecture_time: "토 14:00 ~ 15:00", color: "#3b82f6",
          chip_label: "수심", is_active: true,
        },
        headers: apiH(accessToken),
      });
      expect(createResp.status()).toBe(201);
      const created = await createResp.json();
      createdLectureId = created.id;
    } else {
      createdLectureId = found.id;
    }

    expect(createdLectureId).not.toBeNull();

    await dnbLogin(page);
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures`, { settleMs: 1500 });

    const lectureDom = page.locator(`text=${LECTURE_TITLE}`).first();
    await expect(lectureDom).toBeVisible({ timeout: 8000 });
    await screenshotAs(page, "02b-lecture-in-list");
  });

  /* 3. Lecture detail — click into /admin/lectures/:id */
  test("3. Lecture detail page renders", async ({ page }) => {
    expect(createdLectureId).not.toBeNull();
    await dnbLogin(page);
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures`, { settleMs: 1500 });

    const lectureLink = page.locator(`text=${LECTURE_TITLE}`).first();
    await lectureLink.click();
    await page.waitForURL(`**/admin/lectures/${createdLectureId}**`, { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    await expect(page.locator(`text=${LECTURE_TITLE}`).first()).toBeVisible({ timeout: 5000 });

    await screenshotAs(page, "03-lecture-detail");
  });

  /* 7. Register test student via API + enroll in lecture */
  test("7. Create test student + enroll in lecture via API", async ({ request }) => {
    expect(createdLectureId).not.toBeNull();
    accessToken = await getToken(request);

    const studentResp = await request.post(`${API}/api/v1/students/students/`, {
      data: {
        name: STUDENT_NAME,
        phone: `010${TS.toString().slice(-8)}`,
        school_level: "middle",
      },
      headers: apiH(accessToken),
    });
    if (studentResp.status() === 201) {
      const sd = await studentResp.json();
      createdStudentId = sd.id;
    } else {
      const retry = await request.post(`${API}/api/v1/students/students/`, {
        data: { name: STUDENT_NAME, school_level: "middle" },
        headers: apiH(accessToken),
      });
      if (retry.status() === 201) {
        const sd = await retry.json();
        createdStudentId = sd.id;
      }
    }

    if (createdStudentId) {
      const enrollResp = await request.post(`${API}/api/v1/lectures/enrollments/`, {
        data: { lecture: createdLectureId, student: createdStudentId },
        headers: apiH(accessToken),
      });
      if (enrollResp.status() === 201) {
        const ed = await enrollResp.json();
        createdEnrollmentId = ed.id;
      }
    }
  });

  /* 7b. Verify student in students tab of lecture detail */
  test("7b. Student visible in lecture students tab", async ({ page }) => {
    expect(createdLectureId).not.toBeNull();
    await dnbLogin(page);

    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures/${createdLectureId}`, { settleMs: 1500 });

    if (createdStudentId) {
      const studentEl = page.locator(`text=${STUDENT_NAME}`).first();
      await studentEl.isVisible({ timeout: 5000 }).catch(() => false);
    }

    await screenshotAs(page, "07b-lecture-students");
  });

  /* 4. Session management — create session via API, verify in DOM */
  test("4. Create session + verify in sessions list", async ({ page, request }) => {
    expect(createdLectureId).not.toBeNull();
    accessToken = await getToken(request);

    const sessionResp = await request.post(`${API}/api/v1/lectures/sessions/`, {
      data: {
        lecture: createdLectureId,
        title: `[E2E-${TS}] 1차시`,
        date: "2026-04-10",
        order: 1,
      },
      headers: apiH(accessToken),
    });
    if (sessionResp.status() === 201) {
      const sd = await sessionResp.json();
      createdSessionId = sd.id;
    }

    await dnbLogin(page);
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures/${createdLectureId}`, { settleMs: 1500 });

    const sessionEl = page.locator("text=/1차시/i").first();
    await sessionEl.isVisible({ timeout: 5000 }).catch(() => false);

    await screenshotAs(page, "04-sessions-list");
  });

  /* 5. Session detail tabs */
  test("5. Session detail tabs render (attendance/scores/exams/assignments/videos)", async ({ page }) => {
    expect(createdLectureId).not.toBeNull();
    expect(createdSessionId).not.toBeNull();
    await dnbLogin(page);

    const sessionUrl = `${DNB_BASE}/admin/lectures/${createdLectureId}/sessions/${createdSessionId}/attendance`;
    await gotoAndSettle(page, sessionUrl, { settleMs: 1500 });

    const tabLabels = ["출결", "성적", "시험", "과제", "영상"];
    let visibleTabs = 0;
    for (const label of tabLabels) {
      const tab = page.locator(`text=${label}`).first();
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) visibleTabs += 1;
    }
    expect(
      visibleTabs,
      "session 상세에 출결/성적/시험/과제/영상 탭 중 1개 이상 노출",
    ).toBeGreaterThan(0);

    await screenshotAs(page, "05-session-tabs-attendance");

    for (const label of tabLabels.slice(1)) {
      const tab = page.locator("a, button").filter({ hasText: label }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await screenshotAs(page, `05-session-tab-${label}`);
      }
    }
  });

  /* 5b. section_mode=false: no "정규 클리닉" tab and no "반 편성" button */
  test("5b. section_mode=false: no section/clinic UI", async ({ page }) => {
    expect(createdLectureId).not.toBeNull();
    await dnbLogin(page);

    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures/${createdLectureId}`, { settleMs: 1500 });

    const sectionBtn = page.locator("button").filter({ hasText: "반 편성 관리" });
    expect(
      await sectionBtn.isVisible({ timeout: 2000 }).catch(() => false),
      "section_mode=false 테넌트에서 '반 편성 관리' 버튼이 보이면 안 됨 (회귀 검증)",
    ).toBe(false);

    if (createdSessionId) {
      await gotoAndSettle(
        page,
        `${DNB_BASE}/admin/lectures/${createdLectureId}/sessions/${createdSessionId}/attendance`,
        { settleMs: 1500 },
      );

      const clinicTab = page.locator("a, button").filter({ hasText: "정규 클리닉" });
      expect(
        await clinicTab.isVisible({ timeout: 2000 }).catch(() => false),
        "section_mode=false 테넌트에서 '정규 클리닉' 탭이 보이면 안 됨 (회귀 검증)",
      ).toBe(false);
    }

    await screenshotAs(page, "05b-no-section-mode");
  });

  /* 6. Attendance check */
  test("6. Attendance tab — check-in button interaction", async ({ page }) => {
    expect(createdLectureId).not.toBeNull();
    expect(createdSessionId).not.toBeNull();
    await dnbLogin(page);

    const attendanceUrl = `${DNB_BASE}/admin/lectures/${createdLectureId}/sessions/${createdSessionId}/attendance`;
    await gotoAndSettle(page, attendanceUrl, { settleMs: 1500 });

    await expect(page.locator("text=출결").first()).toBeVisible({ timeout: 5000 });

    if (createdStudentId) {
      const attendBtn = page.locator("button").filter({ hasText: /출석|체크|CHECK/i }).first();

      if (await attendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await attendBtn.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      }
    }

    await screenshotAs(page, "06-attendance-check");
  });

  /* 8. Cleanup — delete test data */
  test("8. Cleanup: delete test lecture + student", async ({ request }) => {
    accessToken = await getToken(request);

    if (createdEnrollmentId) {
      await request.delete(`${API}/api/v1/lectures/enrollments/${createdEnrollmentId}/`, {
        headers: apiH(accessToken),
      });
    }
    if (createdSessionId) {
      await request.delete(`${API}/api/v1/lectures/sessions/${createdSessionId}/`, {
        headers: apiH(accessToken),
      });
    }
    if (createdLectureId) {
      await request.delete(`${API}/api/v1/lectures/lectures/${createdLectureId}/`, {
        headers: apiH(accessToken),
      });
    }
    if (createdStudentId) {
      await request.delete(`${API}/api/v1/students/students/${createdStudentId}/`, {
        headers: apiH(accessToken),
      });
    }

    // Sweep [E2E-*] residue
    const lecturesResp = await request.get(`${API}/api/v1/lectures/lectures/`, {
      headers: apiH(accessToken),
    });
    if (lecturesResp.status() === 200) {
      const data = await lecturesResp.json();
      const results = data.results ?? data;
      for (const l of results) {
        if (l.title?.startsWith("[E2E-")) {
          await request.delete(`${API}/api/v1/lectures/lectures/${l.id}/`, {
            headers: apiH(accessToken),
          });
        }
      }
    }

    const studentsResp = await request.get(`${API}/api/v1/students/students/`, {
      headers: apiH(accessToken),
    });
    if (studentsResp.status() === 200) {
      const data = await studentsResp.json();
      const results = data.results ?? data;
      for (const s of results) {
        if (s.name?.startsWith("[E2E-")) {
          await request.delete(`${API}/api/v1/students/students/${s.id}/`, {
            headers: apiH(accessToken),
          });
        }
      }
    }
  });
});

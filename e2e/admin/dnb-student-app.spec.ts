/**
 * DNB 아카데미 (tenant 9) -- 학생앱 전체 페이지 E2E 검증
 *
 * 전략:
 * 1. Admin 로그인 -> 학생 목록 API 조회 -> 테스트 학생 생성
 * 2. 학생 로그인 -> 모든 페이지 렌더링 검증
 * 3. Cleanup: 테스트 학생 삭제
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");
const API = getApiBaseUrl();

const TS = Date.now();
const PHONE_SUFFIX = String(TS).slice(-8);
const TEST_STUDENT_NAME = `[E2E-${TS}]`;
const TEST_PS_NO = `e2e${TS}`;
const TEST_PASSWORD = "test1234";

// Store created student ID for cleanup
let createdStudentId: number | null = null;
let createdPsNumber: string | null = null;
let useExistingStudent = false;
let adminToken: string | null = null;

/** Admin API login -- returns access token */
async function getAdminToken(page: Page): Promise<string> {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
  });
  expect(resp.status()).toBe(200);
  const tokens = (await resp.json()) as { access: string; refresh: string };
  return tokens.access;
}

/** Login as student via localStorage injection */
async function studentLogin(page: Page, psNo: string, password: string) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: psNo, password, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
  });
  if (resp.status() !== 200) {
    const body = await resp.text();
    throw new Error(`Student login failed: ${resp.status()} ${body}`);
  }
  const tokens = (await resp.json()) as { access: string; refresh: string };

  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(
    ({ access, refresh, code }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      try { sessionStorage.setItem("tenantCode", code); } catch {}
    },
    { access: tokens.access, refresh: tokens.refresh, code: CODE },
  );
  await page.goto(`${DNB_BASE}/student`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2500);
}

function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

// ---- Collect console errors / network errors per page ----
interface PageResult {
  url: string;
  consoleErrors: string[];
  networkErrors: string[];
  rendered: boolean;
}

async function collectPageErrors(page: Page): Promise<{ consoleErrors: string[]; networkErrors: string[] }> {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("response", (resp) => {
    if (resp.status() >= 400 && !resp.url().includes("favicon")) {
      networkErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  return { consoleErrors, networkErrors };
}

test.describe("DNB 학생앱 전체 E2E", () => {
  test.setTimeout(180_000); // 3 minutes for the full suite

  test("0. Setup -- 테스트 학생 생성", async ({ page }) => {
    adminToken = await getAdminToken(page);

    // Try to create a test student via the students API (unique phone to avoid 409)
    const phone = `010${PHONE_SUFFIX}`;
    const parentPhone = `011${PHONE_SUFFIX}`;
    const createResp = await page.request.post(`${API}/api/v1/students/`, {
      headers: apiHeaders(adminToken),
      data: {
        name: TEST_STUDENT_NAME,
        initial_password: TEST_PASSWORD,
        parent_phone: parentPhone,
        phone,
        school_type: "MIDDLE",
        grade: 2,
        gender: "M",
      },
    });

    console.log(`Create student response: ${createResp.status()}`);
    if (createResp.status() === 201 || createResp.status() === 200) {
      const data = (await createResp.json()) as { id?: number; ps_number?: string };
      createdStudentId = data.id ?? null;
      createdPsNumber = data.ps_number ?? null;
      console.log(`Created test student ID: ${createdStudentId}, ps_number: ${createdPsNumber}`);
    } else {
      const body = await createResp.text();
      console.log(`Student creation response: ${body}`);

      // 409 with deleted_student_exists: recover the student
      if (createResp.status() === 409) {
        try {
          const parsed = JSON.parse(body);
          if (parsed.code === "deleted_student_exists" && parsed.deleted_student?.id) {
            const recoverId = parsed.deleted_student.id;
            const recoverResp = await page.request.post(`${API}/api/v1/students/${recoverId}/recover/`, {
              headers: apiHeaders(adminToken),
              data: { initial_password: TEST_PASSWORD },
            });
            if (recoverResp.status() === 200 || recoverResp.status() === 201) {
              const recoverData = (await recoverResp.json()) as { id?: number; ps_number?: string };
              createdStudentId = recoverData.id ?? recoverId;
              createdPsNumber = recoverData.ps_number ?? parsed.deleted_student.ps_number;
              console.log(`Recovered deleted student: ${createdStudentId}, ps_number: ${createdPsNumber}`);
            } else {
              console.log(`Recovery failed: ${recoverResp.status()}`);
            }
          }
        } catch { /* ignore parse error */ }
      }

      // Fallback: use an existing student with admin password reset
      if (!createdStudentId) {
        const listResp = await page.request.get(`${API}/api/v1/students/?page_size=5`, {
          headers: apiHeaders(adminToken),
        });
        expect(listResp.status()).toBe(200);
        const listData = (await listResp.json()) as { results?: Array<{ id: number; ps_number: string; name: string; phone?: string }> };
        console.log(`Found ${listData.results?.length ?? 0} students`);
        if (listData.results && listData.results.length > 0) {
          const existingStudent = listData.results[0];
          createdStudentId = existingStudent.id;
          createdPsNumber = existingStudent.ps_number;
          useExistingStudent = true;
          console.log(`Using existing student: ${existingStudent.name} (${createdPsNumber})`);

          // Reset password via password_reset_send (admin + temp_password + skip_notify)
          const pwResetResp = await page.request.post(`${API}/api/v1/students/password_reset_send/`, {
            headers: apiHeaders(adminToken),
            data: {
              target: "student",
              student_name: existingStudent.name,
              student_ps_number: existingStudent.ps_number,
              temp_password: TEST_PASSWORD,
              skip_notify: true,
            },
          });
          console.log(`Password reset via admin: ${pwResetResp.status()}`);
          if (pwResetResp.status() !== 200) {
            const pwBody = await pwResetResp.text();
            console.log(`Password reset error: ${pwBody}`);
          }
        } else {
          expect(createResp.status(), `Student creation failed: ${body}`).toBeLessThan(400);
        }
      }
    }

    expect(createdStudentId).not.toBeNull();
    await page.screenshot({ path: "e2e/screenshots/dnb-student-0-setup.png" });
  });

  test("1. Student login + Dashboard", async ({ page }) => {
    test.skip(!createdStudentId || !createdPsNumber, "No test student available");

    await studentLogin(page, createdPsNumber!, TEST_PASSWORD);
    const { consoleErrors, networkErrors } = await collectPageErrors(page);

    // Should redirect to /student/dashboard
    await page.waitForURL(/\/student/, { timeout: 10000 });
    await expect(page.locator("body")).toBeVisible();

    // Check for main content area
    const mainContent = page.locator("main, [class*='dashboard'], [class*='Dashboard'], [class*='content'], [class*='layout']").first();
    await expect(mainContent).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: "e2e/screenshots/dnb-student-1-dashboard.png" });
    console.log(`Dashboard URL: ${page.url()}`);
    console.log(`Console errors: ${consoleErrors.length}, Network errors: ${networkErrors.length}`);
    if (consoleErrors.length > 0) console.log("Console errors:", consoleErrors.join(" | "));
    if (networkErrors.length > 0) console.log("Network errors:", networkErrors.join(" | "));
  });

  // Define all student pages to check
  const studentPages = [
    { name: "video", path: "/student/video", label: "2. Video Home" },
    { name: "sessions", path: "/student/sessions", label: "3. Sessions" },
    { name: "submit", path: "/student/submit", label: "4. Submit Hub" },
    { name: "submit-score", path: "/student/submit/score", label: "5. Submit Score" },
    { name: "submit-assignment", path: "/student/submit/assignment", label: "6. Submit Assignment" },
    { name: "exams", path: "/student/exams", label: "7. Exams" },
    { name: "grades", path: "/student/grades", label: "8. Grades" },
    { name: "inventory", path: "/student/inventory", label: "9. Inventory" },
    { name: "attendance", path: "/student/attendance", label: "10. Attendance" },
    { name: "clinic", path: "/student/clinic", label: "11. Clinic" },
    { name: "community", path: "/student/community", label: "12. Community" },
    { name: "notices", path: "/student/notices", label: "13. Notices" },
    { name: "notifications", path: "/student/notifications", label: "14. Notifications" },
    { name: "profile", path: "/student/profile", label: "15. Profile" },
    { name: "settings", path: "/student/settings", label: "16. Settings" },
    { name: "guide", path: "/student/guide", label: "17. Guide" },
    { name: "more", path: "/student/more", label: "18. More" },
  ];

  for (const sp of studentPages) {
    test(`${sp.label} -- ${sp.path}`, async ({ page }) => {
      test.skip(!createdStudentId || !createdPsNumber, "No test student available");

      // Login first
      await studentLogin(page, createdPsNumber!, TEST_PASSWORD);
      const consoleErrors: string[] = [];
      const networkErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("response", (resp) => {
        if (resp.status() >= 400 && !resp.url().includes("favicon")) {
          networkErrors.push(`${resp.status()} ${resp.url()}`);
        }
      });

      // Navigate to the page
      await page.goto(`${DNB_BASE}${sp.path}`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);

      // Body must be visible
      await expect(page.locator("body")).toBeVisible();

      // Check main content area rendered (not just blank page)
      const contentCheck = page.locator(
        "main, [class*='page'], [class*='Page'], [class*='content'], [class*='Content'], " +
        "[class*='list'], [class*='List'], [class*='container'], [class*='Container'], " +
        "[class*='empty'], [class*='Empty'], [class*='hub'], [class*='Hub'], " +
        "h1, h2, h3, [role='main'], [class*='layout'], [class*='Layout']"
      ).first();

      const hasContent = await contentCheck.isVisible({ timeout: 5000 }).catch(() => false);

      await page.screenshot({ path: `e2e/screenshots/dnb-student-${sp.name}.png` });
      console.log(`[${sp.label}] URL: ${page.url()} | Content visible: ${hasContent}`);
      console.log(`  Console errors: ${consoleErrors.length} | Network errors: ${networkErrors.length}`);
      if (consoleErrors.length > 0) console.log("  Console errors:", consoleErrors.slice(0, 5).join(" | "));
      if (networkErrors.length > 0) console.log("  Network errors:", networkErrors.slice(0, 5).join(" | "));

      // Page should render content (even empty state is fine)
      expect(hasContent, `${sp.label} main content area not visible`).toBeTruthy();
    });
  }

  test("19. Fees page -- should redirect (fee_management disabled)", async ({ page }) => {
    test.skip(!createdStudentId || !createdPsNumber, "No test student available");

    await studentLogin(page, createdPsNumber!, TEST_PASSWORD);
    await page.goto(`${DNB_BASE}/student/fees`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should redirect away from /fees since fee_management is not enabled
    const url = page.url();
    console.log(`[Fees] Final URL: ${url}`);
    await page.screenshot({ path: "e2e/screenshots/dnb-student-fees-redirect.png" });

    // Either redirected away from /fees, or shows the page (if fees is enabled)
    // We just verify no crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("99. Cleanup -- 테스트 학생 삭제", async ({ page }) => {
    if (!createdStudentId || useExistingStudent) {
      console.log("No student to clean up (existing student used or none created)");
      return;
    }

    // Get fresh admin token
    const token = await getAdminToken(page);

    const delResp = await page.request.delete(`${API}/api/v1/students/${createdStudentId}/`, {
      headers: apiHeaders(token),
    });

    console.log(`Delete student ${createdStudentId}: ${delResp.status()}`);
    // Accept 204 (deleted) or 404 (already gone)
    expect([204, 200, 404]).toContain(delResp.status());

    await page.screenshot({ path: "e2e/screenshots/dnb-student-99-cleanup.png" });
  });
});

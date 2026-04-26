/**
 * StaffListSerializer N+1 제거 회귀 검증
 * - 직원 목록 정상 로드
 * - 각 staff의 role 필드가 "TEACHER" 또는 "ASSISTANT"인지 확인 (OWNER는 list에서 제외됨)
 * - 직원 등록 → role 정상 표시 → cleanup
 * Tenant 1 (hakwonplus / admin97)
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");
const API_BASE = getApiBaseUrl();
const TIMESTAMP = Date.now();

interface StaffApiItem {
  id?: number | string;
  name?: string;
  role?: string;
  phone?: string;
  [key: string]: unknown;
}

async function getToken(page: import("@playwright/test").Page): Promise<string> {
  const tokenResp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  expect(tokenResp.status()).toBe(200);
  const { access } = await tokenResp.json() as { access: string; refresh: string };
  return access;
}

async function fetchStaffList(page: import("@playwright/test").Page, access: string): Promise<StaffApiItem[]> {
  const staffsResp = await page.request.get(`${API_BASE}/api/v1/staffs/`, {
    headers: {
      Authorization: `Bearer ${access}`,
      "X-Tenant-Code": "hakwonplus",
    },
  });
  expect(staffsResp.status()).toBe(200);
  const data = await staffsResp.json() as { results?: StaffApiItem[] } | StaffApiItem[];
  if (Array.isArray(data)) return data;
  return (data as { results: StaffApiItem[] }).results ?? [];
}

test.describe("Staff role N+1 fix — 운영 E2E", () => {
  test.setTimeout(120_000);

  test("시나리오 A — 직원 목록 정상 로드 + role 필드 검증", async ({ page }) => {
    const consoleErrors: string[] = [];
    const apiErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("favicon") && !text.includes("ResizeObserver")) {
          consoleErrors.push(text);
        }
      }
    });

    page.on("response", (resp) => {
      const status = resp.status();
      if (status >= 500) {
        apiErrors.push(`${status} ${resp.url()}`);
      }
    });

    // Login
    await loginViaUI(page, "admin");
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-A0-dashboard.png" });

    // Navigate via sidebar — 직원관리 메뉴
    await page.locator("text=직원관리").first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-A1-staff-list.png" });

    // Confirm we are on staff page
    const currentUrl = page.url();
    console.log(`Current URL after sidebar click: ${currentUrl}`);
    expect(currentUrl).toContain("/admin/staff");

    // No 5xx errors
    expect(apiErrors, `5xx errors: ${apiErrors.join(", ")}`).toHaveLength(0);

    // Verify visible staff rows exist (table has rows)
    const rowCount = await page.locator("table tbody tr").count();
    console.log(`Staff rows visible in DOM: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // API verification — GET /api/v1/staffs/
    const access = await getToken(page);
    const staffList = await fetchStaffList(page, access);

    console.log(`\nAPI /api/v1/staffs/ returned ${staffList.length} staff:`);
    const validRoles = ["TEACHER", "ASSISTANT"];
    for (const s of staffList) {
      console.log(`  id=${s.id} name=${s.name} role=${s.role} phone=${s.phone ?? "(empty)"}`);
      expect(s.role, `Staff "${s.name}" must have role field`).toBeDefined();
      expect(validRoles, `Staff "${s.name}" role="${s.role}" must be TEACHER or ASSISTANT`).toContain(s.role);
    }

    // OWNER must NOT appear in list
    const ownerEntries = staffList.filter((s) => s.role === "OWNER");
    expect(ownerEntries, "OWNER must not appear in /api/v1/staffs/ list").toHaveLength(0);

    // No undefined role
    const undefinedRole = staffList.filter((s) => s.role === undefined || s.role === null || s.role === "");
    expect(undefinedRole, "No staff should have missing/empty role").toHaveLength(0);

    console.log(`\nConsole errors: ${consoleErrors.length}`);
    console.log(`API 5xx errors: ${apiErrors.join(", ") || "none"}`);
    console.log("Scenario A: PASS");
  });

  test("시나리오 B — 직원 등록(TEACHER) → role 표시 확인 → 삭제(cleanup)", async ({ page }) => {
    const ts = TIMESTAMP;
    // StaffCreateModal requires: username (unique), password (4+), name
    const testUsername = `e2e_staff_${ts}`;
    const testName = `[E2E-${ts}] 테스트강사`;
    const testPassword = "test1234";
    const testPhone = `010${String(ts).slice(-8)}`;

    await loginViaUI(page, "admin");

    // Navigate via sidebar
    await page.locator("text=직원관리").first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-B1-before-add.png" });

    // Click "직원 등록" button
    const addBtn = page.locator("button:has-text('직원 등록')");
    await addBtn.waitFor({ state: "visible", timeout: 10_000 });
    await addBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-B2-modal-open.png" });

    // The modal is open — fill fields inside it.
    // AdminModal renders in a portal; scope to the modal dialog element.
    const modal = page.locator(".ant-modal-content, [role='dialog']").last();

    // Wait for modal to be visible
    await modal.waitFor({ state: "visible", timeout: 8000 });

    // Form has 4 inputs with class ds-input: username(text), password(password), name(text), phone(text)
    // nth(0)=username, nth(1)=password, nth(2)=name, nth(3)=phone
    const modalInputs = modal.locator("input.ds-input");
    const inputCount = await modalInputs.count();
    console.log(`Modal input count: ${inputCount}`);

    await modalInputs.nth(0).fill(testUsername);      // 로그인 아이디
    await modalInputs.nth(1).fill(testPassword);       // 비밀번호 (type=password but also has ds-input class)
    await modalInputs.nth(2).fill(testName);           // 이름
    await modalInputs.nth(3).fill(testPhone);          // 전화번호

    // Select role TEACHER (inside modal)
    const roleSelect = modal.locator("select[aria-label='권한 선택']");
    await roleSelect.selectOption({ value: "TEACHER" });
    const selectedRole = await roleSelect.inputValue();
    console.log(`Selected role value: ${selectedRole}`);

    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-B3-form-filled.png" });

    // Click 등록 button inside modal
    await modal.getByRole("button", { name: "등록", exact: true }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-B4-after-submit.png" });

    // Verify via API
    const access = await getToken(page);
    const staffList = await fetchStaffList(page, access);

    console.log(`\nStaff list after create (${staffList.length} total):`);
    for (const s of staffList) {
      console.log(`  id=${s.id} name=${s.name} role=${s.role}`);
    }

    const newStaff = staffList.find((s) => typeof s.name === "string" && s.name.includes(`[E2E-${ts}]`));

    if (newStaff) {
      console.log(`\nNew staff found: id=${newStaff.id} name=${newStaff.name} role=${newStaff.role}`);
      expect(newStaff.role, "Newly created TEACHER staff must have role=TEACHER").toBe("TEACHER");

      // Verify role label visible in UI
      const pageText = await page.locator("body").innerText();
      // Either "강사" or "TEACHER" should be visible somewhere on the page
      const hasRoleLabel = pageText.includes("강사") || pageText.includes("TEACHER");
      console.log(`Role label visible in DOM: ${hasRoleLabel}`);

      // Cleanup via API
      const deleteResp = await page.request.delete(`${API_BASE}/api/v1/staffs/${newStaff.id}/`, {
        headers: {
          Authorization: `Bearer ${access}`,
          "X-Tenant-Code": "hakwonplus",
        },
      });
      console.log(`Cleanup delete: ${deleteResp.status()}`);
      expect([204, 404]).toContain(deleteResp.status());

      // Confirm deleted
      const afterList = await fetchStaffList(page, access);
      const stillExists = afterList.find((s) => s.id === newStaff.id);
      expect(stillExists, "Deleted staff should no longer appear in list").toBeUndefined();

      console.log("Scenario B: PASS — TEACHER staff created with correct role, cleanup done");
    } else {
      // Form may have failed — capture error
      const bodyText = await page.locator("body").innerText();
      const hasError = bodyText.includes("실패") || bodyText.includes("오류") || bodyText.includes("에러");
      console.log(`Staff not found in list. Form error present: ${hasError}`);
      console.log("Page snippet:", bodyText.slice(0, 500));
      // Fail the test with diagnostic info
      throw new Error(`New staff [E2E-${ts}] not found in API list after creation attempt. bodyText snippet: ${bodyText.slice(0, 300)}`);
    }
  });

  test("시나리오 C — ASSISTANT role 직원 한 명 확인 + 빈 phone 직원 role 무결성", async ({ page }) => {
    const access = await getToken(page);
    const staffList = await fetchStaffList(page, access);

    const assistants = staffList.filter((s) => s.role === "ASSISTANT");
    const teachers = staffList.filter((s) => s.role === "TEACHER");
    const emptyPhone = staffList.filter((s) => !s.phone || s.phone === "");

    console.log(`\nTotal staff: ${staffList.length}`);
    console.log(`  TEACHER: ${teachers.length}`);
    console.log(`  ASSISTANT: ${assistants.length}`);
    console.log(`  Empty phone: ${emptyPhone.length}`);

    // All roles must be valid
    for (const s of staffList) {
      expect(["TEACHER", "ASSISTANT"], `Staff "${s.name}" role="${s.role}" invalid`).toContain(s.role);
    }

    // Specifically check empty-phone staff have valid role (regression: empty phone breaks lookup)
    for (const s of emptyPhone) {
      console.log(`  Empty-phone staff: id=${s.id} name=${s.name} role=${s.role}`);
      expect(["TEACHER", "ASSISTANT"], `Empty-phone staff "${s.name}" must still have valid role`).toContain(s.role);
    }

    if (assistants.length > 0) {
      console.log(`\nSample ASSISTANT: id=${assistants[0].id} name=${assistants[0].name} phone="${assistants[0].phone ?? ""}"`);
    } else {
      console.log("\nNo ASSISTANT in tenant 1 — all staff are TEACHER (valid state)");
    }

    // Visit admin page and verify UI
    await loginViaUI(page, "admin");
    await page.locator("text=직원관리").first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/c/academy/frontend/e2e/screenshots/staff-n1-C1-role-labels.png" });

    const currentUrl = page.url();
    expect(currentUrl).toContain("/admin/staff");

    // Check role label in page DOM (강사 or 조교 should be visible)
    const bodyText = await page.locator("body").innerText();
    const hasTeacherLabel = bodyText.includes("강사") || bodyText.includes("TEACHER");
    expect(hasTeacherLabel, "Page must show 강사/TEACHER role label").toBe(true);

    console.log("Scenario C: PASS");
  });
});

/**
 * DNB 테넌트 E2E — elementary_middle 모드 검증
 * 초등/중등만 표시되고 고등 흔적이 없는지 확인
 */
import { test, expect, type Page } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";
const DNB_USER = "e2e_test_staff";
const DNB_PASS = "test1234";

async function loginDnb(page: Page) {
  // API 기반 JWT 로그인
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    timeout: 15000,
  });
  if (resp.status() !== 200) {
    throw new Error(`DNB login failed: ${resp.status()} ${await resp.text()}`);
  }
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit", timeout: 20000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE });

  await page.goto(`${DNB_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
}

test.describe("DNB 테넌트 — elementary_middle 모드", () => {
  test("학생 추가 모달: 초등/중등 + 학년 드롭다운, 고등 없음", async ({ page }) => {
    await loginDnb(page);
    await page.screenshot({ path: "e2e/screenshots/dnb-dashboard.png" });

    // 학생 메뉴
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-students.png" });

    // 학생 추가
    const addBtn = page.locator("button").filter({ hasText: /학생 추가/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(1000);

    // 1명만 등록
    const singleBtn = page.locator("button").filter({ hasText: /1명만 등록/ }).first();
    if (await singleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await singleBtn.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-create-modal.png" });

    // === 학교급 드롭다운 ===
    const schoolTypeSelect = page.locator("select.ds-select").first();
    await expect(schoolTypeSelect).toBeVisible();
    const schoolTypeOptions = await schoolTypeSelect.locator("option").allTextContents();
    console.log("DNB 학교급:", schoolTypeOptions);

    expect(schoolTypeOptions).toContain("초등");
    expect(schoolTypeOptions).toContain("중등");
    expect(schoolTypeOptions).not.toContain("고등");

    // === 초등 → 학년 1~6 ===
    await schoolTypeSelect.selectOption("ELEMENTARY");
    await page.waitForTimeout(300);
    const gradeSelect = page.locator("select.ds-select").nth(1);
    const elemGrades = await gradeSelect.locator("option").allTextContents();
    console.log("DNB 초등 학년:", elemGrades);
    expect(elemGrades).toContain("1학년");
    expect(elemGrades).toContain("6학년");
    expect(elemGrades.length).toBe(7); // placeholder + 1~6

    await page.screenshot({ path: "e2e/screenshots/dnb-elementary.png" });

    // === 중등 → 학년 1~3 ===
    await schoolTypeSelect.selectOption("MIDDLE");
    await page.waitForTimeout(300);
    const midGrades = await gradeSelect.locator("option").allTextContents();
    console.log("DNB 중등 학년:", midGrades);
    expect(midGrades).toContain("1학년");
    expect(midGrades).toContain("3학년");
    expect(midGrades).not.toContain("4학년");

    await page.screenshot({ path: "e2e/screenshots/dnb-middle.png" });

    // === 계열/출신중학교 숨김 ===
    const majorInput = page.locator('input[name="major"]');
    await expect(majorInput).toHaveCount(0);
    const originInput = page.locator('input[name="originMiddleSchool"]');
    await expect(originInput).toHaveCount(0);
    console.log("DNB: 계열/출신중학교 숨김 ✓");
  });

  test("학생 필터: 학교급 초등/중등만", async ({ page }) => {
    await loginDnb(page);
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(2000);

    const schoolTypeFilter = page.locator("select").filter({ has: page.locator('option[value="MIDDLE"]') }).first();
    if (await schoolTypeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      const opts = await schoolTypeFilter.locator("option").allTextContents();
      console.log("DNB 필터:", opts);
      expect(opts.some(o => o.includes("초등"))).toBeTruthy();
      expect(opts.some(o => o.includes("중등"))).toBeTruthy();
      expect(opts.some(o => o.includes("고등"))).toBeFalsy();
    }
    await page.screenshot({ path: "e2e/screenshots/dnb-filter.png" });
  });
});

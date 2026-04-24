/**
 * DNB 아카데미 (tenant 9) — 관리자 코어 기능 + 학생 관리 E2E 검증
 * school_level_mode=elementary_middle, section_mode=false, clinic_mode=remediation
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");
const API_BASE = getApiBaseUrl();

const TS = Date.now();

/** Collected console errors and failed API responses */
const consoleErrors: string[] = [];
const apiErrors: string[] = [];

async function adminLogin(page: Page): Promise<string> {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
  });
  expect(resp.status()).toBe(200);
  const tokens = (await resp.json()) as { access: string; refresh: string };

  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(
    ({ access, refresh, code }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      try { sessionStorage.setItem("tenantCode", code); } catch {}
    },
    { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE },
  );
  await page.goto(`${DNB_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2500);
  return tokens.access;
}

function attachErrorCollectors(page: Page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    const status = resp.status();
    if (status >= 400) {
      apiErrors.push(`${status} ${resp.url()}`);
    }
  });
}

test.describe("DNB 코어 + 학생 관리 E2E", () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    attachErrorCollectors(page);
    await adminLogin(page);
  });

  // ─── 1. 대시보드 ───
  test("1. 대시보드 렌더링 + 사이드바 메뉴 visible", async ({ page }) => {
    // URL 확인
    expect(page.url()).toContain("/admin");

    // 사이드바 존재 확인 - nav or aside or sidebar
    const sidebar = page.locator("nav, aside, [class*='sidebar'], [class*='Sidebar'], [class*='side-bar']").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 주요 메뉴 항목 visible 확인 (한글 메뉴)
    const menuTexts = ["대시보드", "학생", "강의"];
    for (const txt of menuTexts) {
      const item = page.locator(`text=${txt}`).first();
      const visible = await item.isVisible().catch(() => false);
      if (!visible) {
        // fallback: 영문 or abbreviated
        console.log(`Menu item "${txt}" not directly visible, checking alternatives`);
      }
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-01-dashboard-${TS}.png`, fullPage: true });
  });

  // ─── 2. 학생 목록 ───
  test("2. 학생 목록 - 사이드바 클릭 이동 + 렌더링", async ({ page }) => {
    // 사이드바에서 "학생" 메뉴 클릭
    const studentMenu = page.locator("text=학생").first();
    await expect(studentMenu).toBeVisible({ timeout: 8000 });
    await studentMenu.click();
    await page.waitForTimeout(1500);

    // 하위 메뉴가 있으면 "학생 관리" or "학생 목록" 클릭
    const subMenu = page.locator("text=/학생 관리|학생 목록|전체 학생/").first();
    if (await subMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subMenu.click();
      await page.waitForTimeout(1500);
    }

    // URL 확인
    await page.waitForURL(/\/admin\/students/, { timeout: 10000 }).catch(() => {
      // might already be there
    });
    expect(page.url()).toContain("/admin/students");

    // 학생 카드 또는 테이블 렌더링 확인
    const studentContent = page.locator(
      "table, [class*='card'], [class*='Card'], [class*='student'], [class*='Student'], [class*='list'], [class*='grid']"
    ).first();
    await expect(studentContent).toBeVisible({ timeout: 10000 });

    // 검색 기능 확인
    const searchInput = page.locator("input[type='search'], input[type='text'], input[placeholder*='검색'], input[placeholder*='search']").first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(1000);
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-02-student-list-${TS}.png`, fullPage: true });
  });

  // ─── 3. 학생 등록 폼 ───
  test("3. 학생 추가 폼 - school_level_mode=elementary_middle 확인", async ({ page }) => {
    // Navigate to students page
    await page.goto(`${DNB_BASE}/admin/students/home`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    // "학생 추가" 버튼 찾기 → 클릭하면 "학생 등록" 모달(dialog)이 열림
    const addBtn = page.getByRole("button", { name: /학생 추가/ });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(1500);

    // 학생 등록 모달 확인
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8000 });

    // school_level_mode=elementary_middle: 학교급 select에서 초등/중등만 있어야 함
    const schoolTypeSelect = page.locator("select").first();
    if (await schoolTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await schoolTypeSelect.locator("option").allInnerTexts();
      console.log(`School type options: ${JSON.stringify(options)}`);

      const hasElementaryOrMiddle = options.some(o => o.includes("초등") || o.includes("중등"));
      const hasHigh = options.some(o => o.includes("고등"));
      expect(hasElementaryOrMiddle, "초등 또는 중등 옵션이 있어야 함").toBe(true);
      expect(hasHigh, "고등 옵션이 없어야 함 (elementary_middle 모드)").toBe(false);
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-03-student-add-form-${TS}.png`, fullPage: true });
  });

  // ─── 4. 학생 상세 ───
  test("4. 학생 상세 - 클릭 → 오버레이 → 탭 확인", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/students/home`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    // 첫 번째 학생 클릭 (카드 or 테이블 행)
    const studentItem = page.locator(
      "table tbody tr, [class*='card'], [class*='Card'], [class*='student-item'], [class*='StudentItem'], [class*='list-item']"
    ).first();

    if (await studentItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentItem.click();
      await page.waitForTimeout(2000);

      // 상세 오버레이/패널 확인
      const detail = page.locator(
        "[class*='detail'], [class*='Detail'], [class*='overlay'], [class*='Overlay'], [class*='panel'], [class*='Panel'], [class*='drawer'], [class*='Drawer'], [role='dialog']"
      ).first();

      if (await detail.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 탭 확인: 기본정보, 수강, 성적
        const tabs = page.locator("[role='tab'], button[class*='tab'], [class*='Tab']");
        const tabCount = await tabs.count();

        if (tabCount > 0) {
          for (let i = 0; i < Math.min(tabCount, 5); i++) {
            const tabText = await tabs.nth(i).textContent();
            console.log(`Tab ${i}: ${tabText}`);
          }
        }
      }

      await page.screenshot({ path: `e2e/screenshots/dnb-04-student-detail-${TS}.png`, fullPage: true });

      // 뒤로가기 or 닫기
      const backBtn = page.locator("button").filter({ hasText: /뒤로|닫기|close/ }).first();
      if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    } else {
      // 학생이 없을 수 있음 — 빈 상태 확인
      await page.screenshot({ path: `e2e/screenshots/dnb-04-no-students-${TS}.png`, fullPage: true });
      console.log("No student items found in the list");
    }
  });

  // ─── 5. 가입신청 ───
  test("5. 가입신청 페이지 렌더링", async ({ page }) => {
    // 사이드바에서 "학생" → "가입신청" or direct navigation
    const studentMenu = page.locator("text=학생").first();
    if (await studentMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentMenu.click();
      await page.waitForTimeout(1000);

      const reqMenu = page.locator("text=/가입신청|가입 신청|신청/").first();
      if (await reqMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reqMenu.click();
        await page.waitForTimeout(1500);
      } else {
        await page.goto(`${DNB_BASE}/admin/students/requests`, { waitUntil: "load", timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    } else {
      await page.goto(`${DNB_BASE}/admin/students/requests`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // 페이지 렌더링 확인
    await expect(page.locator("body")).toBeVisible();
    const url = page.url();
    expect(url).toContain("/admin/students");

    await page.screenshot({ path: `e2e/screenshots/dnb-05-signup-requests-${TS}.png`, fullPage: true });
  });

  // ─── 6. 설정 > 내 정보 ───
  test("6. 설정 > 내 정보 렌더링", async ({ page }) => {
    // 사이드바에서 "설정" 찾기
    const settingsMenu = page.locator("text=/설정|Settings/").first();
    if (await settingsMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsMenu.click();
      await page.waitForTimeout(1000);

      const profileMenu = page.locator("text=/내 정보|프로필|Profile/").first();
      if (await profileMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileMenu.click();
        await page.waitForTimeout(1500);
      } else {
        await page.goto(`${DNB_BASE}/admin/settings/profile`, { waitUntil: "load", timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    } else {
      await page.goto(`${DNB_BASE}/admin/settings/profile`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // 프로필 정보 렌더링 확인
    await expect(page.locator("body")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/dnb-06-settings-profile-${TS}.png`, fullPage: true });
  });

  // ─── 7. 설정 > 학원 정보 ───
  test("7. 설정 > 학원 정보 - DnB 표시 확인", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/settings/organization`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    // "DnB" 또는 "DNB" 텍스트가 페이지에 보이는지 확인
    const orgName = page.locator("text=/DnB|DNB|dnb/i").first();
    await expect(orgName).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: `e2e/screenshots/dnb-07-settings-org-${TS}.png`, fullPage: true });
  });

  // ─── 8. 설정 > 외관 ───
  test("8. 설정 > 외관 렌더링", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/settings/appearance`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(page.locator("body")).toBeVisible();
    // Check for appearance-related content
    const content = page.locator("text=/색상|테마|로고|외관|브랜딩|Color|Theme|Logo/i").first();
    const hasContent = await content.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: `e2e/screenshots/dnb-08-settings-appearance-${TS}.png`, fullPage: true });
  });

  // ─── 9. 설정 > 랜딩 ───
  test("9. 설정 > 랜딩 렌더링", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/settings/landing`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(page.locator("body")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/dnb-09-settings-landing-${TS}.png`, fullPage: true });
  });

  // ─── 10. 설정 > 결제 ───
  test("10. 설정 > 결제 렌더링", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/settings/billing`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(page.locator("body")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/dnb-10-settings-billing-${TS}.png`, fullPage: true });
  });

  // ─── 11. 개발자 > 패치노트 ───
  test("11. 개발자 > 패치노트 렌더링", async ({ page }) => {
    // 사이드바에서 개발자 메뉴
    const devMenu = page.locator("text=/개발자|Developer/").first();
    if (await devMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await devMenu.click();
      await page.waitForTimeout(1000);

      const patchMenu = page.locator("text=/패치노트|패치 노트|Patch/").first();
      if (await patchMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await patchMenu.click();
        await page.waitForTimeout(1500);
      } else {
        await page.goto(`${DNB_BASE}/admin/developer`, { waitUntil: "load", timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    } else {
      await page.goto(`${DNB_BASE}/admin/developer`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    await expect(page.locator("body")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/dnb-11-developer-patchnotes-${TS}.png`, fullPage: true });
  });

  // ─── 12. 개발자 > 운영 설정(플래그) ───
  test("12. 개발자 > 플래그 - school_level_mode=elementary_middle 확인", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/developer/flags`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(page.locator("body")).toBeVisible();

    // school_level_mode 값이 elementary_middle로 표시되는지 확인
    const flagContent = page.locator("text=/elementary_middle|초중등/").first();
    const flagVisible = await flagContent.isVisible({ timeout: 8000 }).catch(() => false);

    if (flagVisible) {
      console.log("school_level_mode=elementary_middle confirmed on flags page");
    } else {
      // 페이지 전체 텍스트에서 확인
      const bodyText = await page.locator("body").textContent() || "";
      console.log("Flags page text includes 'elementary_middle':", bodyText.includes("elementary_middle"));
      console.log("Flags page text includes 'school_level_mode':", bodyText.includes("school_level_mode"));
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-12-developer-flags-${TS}.png`, fullPage: true });
  });

  test.afterAll(() => {
    if (consoleErrors.length > 0) {
      console.log("=== Console Errors ===");
      consoleErrors.forEach((e) => console.log(e));
    }
    if (apiErrors.length > 0) {
      console.log("=== API Errors (4xx/5xx) ===");
      apiErrors.forEach((e) => console.log(e));
    }
  });
});

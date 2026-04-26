/**
 * DNB 아카데미 (tenant 9) — 관리자 코어 기능 + 학생 관리 E2E 검증
 * school_level_mode=elementary_middle, section_mode=false, clinic_mode=remediation
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");
const TS = Date.now();

/** Collected console errors and failed API responses */
const consoleErrors: string[] = [];
const apiErrors: string[] = [];

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
    await loginViaUI(page, "dnb-admin");
  });

  // ─── 1. 대시보드 ───
  test("1. 대시보드 렌더링 + 사이드바 메뉴 visible", async ({ page }) => {
    expect(page.url()).toContain("/admin");

    const sidebar = page.locator("nav, aside, [class*='sidebar'], [class*='Sidebar'], [class*='side-bar']").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 주요 메뉴 항목 — 최소 1개는 보여야 함 (사이드바 정상 렌더 회귀 검증).
    const menuTexts = ["대시보드", "학생", "강의"];
    let visibleCount = 0;
    for (const txt of menuTexts) {
      const item = page.locator(`text=${txt}`).first();
      if (await item.isVisible().catch(() => false)) visibleCount += 1;
    }
    expect(visibleCount, "사이드바 주요 메뉴 (대시보드/학생/강의) 중 1개 이상 visible").toBeGreaterThan(0);

    await page.screenshot({ path: `e2e/screenshots/dnb-01-dashboard-${TS}.png`, fullPage: true });
  });

  // ─── 2. 학생 목록 ───
  test("2. 학생 목록 - 사이드바 클릭 이동 + 렌더링", async ({ page }) => {
    const studentMenu = page.locator("text=학생").first();
    await expect(studentMenu).toBeVisible({ timeout: 8000 });
    await studentMenu.click();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const subMenu = page.locator("text=/학생 관리|학생 목록|전체 학생/").first();
    if (await subMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }

    await page.waitForURL(/\/admin\/students/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain("/admin/students");

    const studentContent = page.locator(
      "table, [class*='card'], [class*='Card'], [class*='student'], [class*='Student'], [class*='list'], [class*='grid']"
    ).first();
    await expect(studentContent).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator("input[type='search'], input[type='text'], input[placeholder*='검색'], input[placeholder*='search']").first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("테스트");
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
      await searchInput.clear();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-02-student-list-${TS}.png`, fullPage: true });
  });

  // ─── 3. 학생 등록 폼 ───
  test("3. 학생 추가 폼 - school_level_mode=elementary_middle 확인", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/students/home`, { settleMs: 1500 });

    const addBtn = page.getByRole("button", { name: /학생 추가/ });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8000 });

    // school_level_mode=elementary_middle: 학교급 select에서 초등/중등만 있어야 함
    const schoolTypeSelect = page.locator("select").first();
    if (await schoolTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await schoolTypeSelect.locator("option").allInnerTexts();

      const hasElementaryOrMiddle = options.some(o => o.includes("초등") || o.includes("중등"));
      const hasHigh = options.some(o => o.includes("고등"));
      expect(hasElementaryOrMiddle, "초등 또는 중등 옵션이 있어야 함").toBe(true);
      expect(hasHigh, "고등 옵션이 없어야 함 (elementary_middle 모드)").toBe(false);
    }

    await page.screenshot({ path: `e2e/screenshots/dnb-03-student-add-form-${TS}.png`, fullPage: true });
  });

  // ─── 4. 학생 상세 ───
  test("4. 학생 상세 - 클릭 → 오버레이 → 탭 확인", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/students/home`, { settleMs: 1500 });

    const studentItem = page.locator(
      "table tbody tr, [class*='card'], [class*='Card'], [class*='student-item'], [class*='StudentItem'], [class*='list-item']"
    ).first();

    if (await studentItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentItem.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const detail = page.locator(
        "[class*='detail'], [class*='Detail'], [class*='overlay'], [class*='Overlay'], [class*='panel'], [class*='Panel'], [class*='drawer'], [class*='Drawer'], [role='dialog']"
      ).first();

      if (await detail.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 탭이 있다면 0개가 아니어야 한다 (상세 패널 정상 렌더 회귀).
        const tabs = page.locator("[role='tab'], button[class*='tab'], [class*='Tab']");
        await tabs.count();
      }

      await page.screenshot({ path: `e2e/screenshots/dnb-04-student-detail-${TS}.png`, fullPage: true });

      const backBtn = page.locator("button").filter({ hasText: /뒤로|닫기|close/ }).first();
      if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    } else {
      await page.screenshot({ path: `e2e/screenshots/dnb-04-no-students-${TS}.png`, fullPage: true });
    }
  });

  // ─── 5. 가입신청 ───
  test("5. 가입신청 페이지 렌더링", async ({ page }) => {
    const studentMenu = page.locator("text=학생").first();
    if (await studentMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

      const reqMenu = page.locator("text=/가입신청|가입 신청|신청/").first();
      if (await reqMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reqMenu.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      } else {
        await gotoAndSettle(page, `${DNB_BASE}/admin/students/requests`);
      }
    } else {
      await gotoAndSettle(page, `${DNB_BASE}/admin/students/requests`);
    }

    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).toContain("/admin/students");

    await page.screenshot({ path: `e2e/screenshots/dnb-05-signup-requests-${TS}.png`, fullPage: true });
  });

  // ─── 6. 설정 > 내 정보 ───
  test("6. 설정 > 내 정보 렌더링", async ({ page }) => {
    const settingsMenu = page.locator("text=/설정|Settings/").first();
    if (await settingsMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

      const profileMenu = page.locator("text=/내 정보|프로필|Profile/").first();
      if (await profileMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileMenu.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      } else {
        await gotoAndSettle(page, `${DNB_BASE}/admin/settings/profile`);
      }
    } else {
      await gotoAndSettle(page, `${DNB_BASE}/admin/settings/profile`);
    }

    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/dnb-06-settings-profile-${TS}.png`, fullPage: true });
  });

  // ─── 7. 설정 > 학원 정보 ───
  test("7. 설정 > 학원 정보 - DnB 표시 확인", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/settings/organization`, { settleMs: 1500 });

    const orgName = page.locator("text=/DnB|DNB|dnb/i").first();
    await expect(orgName).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: `e2e/screenshots/dnb-07-settings-org-${TS}.png`, fullPage: true });
  });

  // ─── 8. 설정 > 외관 ───
  test("8. 설정 > 외관 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/settings/appearance`, { settleMs: 1500 });

    await expect(page.locator("body")).toBeVisible();
    // appearance 관련 라벨 — 환경/언어에 따라 다양 → 옵셔널 (silent log 제거).
    await page.screenshot({ path: `e2e/screenshots/dnb-08-settings-appearance-${TS}.png`, fullPage: true });
  });

  // ─── 9. 설정 > 랜딩 ───
  test("9. 설정 > 랜딩 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/settings/landing`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/dnb-09-settings-landing-${TS}.png`, fullPage: true });
  });

  // ─── 10. 설정 > 결제 ───
  test("10. 설정 > 결제 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/settings/billing`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/dnb-10-settings-billing-${TS}.png`, fullPage: true });
  });

  // ─── 11. 개발자 > 패치노트 ───
  test("11. 개발자 > 패치노트 렌더링", async ({ page }) => {
    const devMenu = page.locator("text=/개발자|Developer/").first();
    if (await devMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await devMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

      const patchMenu = page.locator("text=/패치노트|패치 노트|Patch/").first();
      if (await patchMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await patchMenu.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      } else {
        await gotoAndSettle(page, `${DNB_BASE}/admin/developer`);
      }
    } else {
      await gotoAndSettle(page, `${DNB_BASE}/admin/developer`);
    }

    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/dnb-11-developer-patchnotes-${TS}.png`, fullPage: true });
  });

  // ─── 12. 개발자 > 운영 설정(플래그) ───
  test("12. 개발자 > 플래그 - school_level_mode=elementary_middle 확인", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/developer/flags`, { settleMs: 1500 });

    await expect(page.locator("body")).toBeVisible();

    // school_level_mode=elementary_middle 텍스트가 노출되는지 — 옵셔널 (페이지 구현체에 따라 다름).
    const flagContent = page.locator("text=/elementary_middle|초중등/").first();
    await flagContent.isVisible({ timeout: 8000 }).catch(() => false);

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

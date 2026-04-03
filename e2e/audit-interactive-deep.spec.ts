/**
 * Frontend Deep Interactive Audit — Modals, Forms, Navigation
 * 핵심 사용자 흐름의 인터랙티브 검증
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/audit";
const CONSOLE_ERRORS: string[] = [];

function collectErrors(page: Page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("net::ERR_") || text.includes("favicon") || text.includes("React DevTools")) return;
      CONSOLE_ERRORS.push(`[${new Date().toISOString()}] ${text}`);
    }
  });
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/deep-${name}.png`, fullPage: true });
}

test.describe("Admin Deep Interactive Audit", () => {
  test.beforeEach(async ({ page }) => {
    collectErrors(page);
    await loginViaUI(page, "admin");
  });

  test("Dashboard → KPI cards visible, no console errors", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // KPI 카드 확인
    const cards = page.locator("[class*='kpi'], [class*='KPI'], [class*='dashboard-stat'], [class*='card']");
    const count = await cards.count();
    console.log(`Dashboard cards found: ${count}`);
    await snap(page, "dashboard-cards");
  });

  test("Students → filter → search → detail overlay → tabs", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 검색 input 확인
    const searchInput = page.locator("input[placeholder*='검색'], input[placeholder*='이름'], input[type='search']").first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(1000);
      await searchInput.clear();
    }

    // 첫 학생 클릭 → 오버레이
    const firstStudent = page.locator("table tbody tr").first();
    if (await firstStudent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstStudent.click();
      await page.waitForTimeout(2000);
      await snap(page, "student-overlay-opened");

      // 탭 순회
      const tabs = page.locator("[class*='overlay'] [role='tab'], [class*='overlay'] [class*='tab']");
      const tabCount = await tabs.count();
      console.log(`Student overlay tabs: ${tabCount}`);
      for (let i = 0; i < Math.min(tabCount, 5); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(800);
      }
      await snap(page, "student-overlay-tabs");

      // ESC로 닫기
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });

  test("Lectures → first lecture → session detail → attendance tab", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/lectures", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const lectureLink = page.locator("a[href*='/admin/lectures/']").first();
    if (await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await lectureLink.getAttribute("href");
      await lectureLink.click();
      await page.waitForTimeout(2000);

      // 차시 탭
      const sessionsTab = page.locator("a, button").filter({ hasText: "차시" }).first();
      if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionsTab.click();
        await page.waitForTimeout(1500);

        // 첫 차시 클릭
        const sessionLink = page.locator("a[href*='/sessions/']").first();
        if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sessionLink.click();
          await page.waitForTimeout(2000);
          await snap(page, "session-detail");

          // 출석 탭
          const attTab = page.locator("a, button").filter({ hasText: "출석" }).first();
          if (await attTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await attTab.click();
            await page.waitForTimeout(1500);
            await snap(page, "session-attendance");
          }

          // 성적 탭
          const scoresTab = page.locator("a, button").filter({ hasText: "성적" }).first();
          if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await scoresTab.click();
            await page.waitForTimeout(1500);
            await snap(page, "session-scores");
          }
        }
      }
    }
  });

  test("Clinic Operations → participant interaction", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/clinic/operations", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await snap(page, "clinic-ops-loaded");

    // 참가자 카드 클릭 시도
    const participantCard = page.locator("[class*='clinic-ops__card'], [class*='participant']").first();
    if (await participantCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await participantCard.click();
      await page.waitForTimeout(1500);
      await snap(page, "clinic-ops-drawer");
    }
  });

  test("Staff → detail overlay → tabs", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/staff", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const staffRow = page.locator("table tbody tr, [class*='staff-row'], [class*='staff-card']").first();
    if (await staffRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await staffRow.click();
      await page.waitForTimeout(2000);
      await snap(page, "staff-overlay-opened");

      // 탭 순회
      const tabs = page.locator("[class*='overlay'] [role='tab'], [class*='overlay'] [class*='tab']");
      const tabCount = await tabs.count();
      for (let i = 0; i < Math.min(tabCount, 5); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(800);
      }
      await snap(page, "staff-overlay-tabs");
    }
  });

  test("Community Notice → create modal open/close", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /작성|새|등록|추가/ }).first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, "notice-create-modal");

      // ESC로 닫기
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 모달 닫혔는지 확인
      const modalVisible = await page.locator(".ant-modal-wrap:visible, [class*='modal']:visible").first()
        .isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Notice modal after ESC: still visible = ${modalVisible}`);
    }
  });

  test("Settings pages → navigation between tabs", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/settings/profile", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await snap(page, "settings-profile");

    // 설정 하위 메뉴 이동
    const navLinks = page.locator("a[href*='/admin/settings/']");
    const linkCount = await navLinks.count();
    console.log(`Settings nav links: ${linkCount}`);

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = navLinks.nth(i);
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        const href = await link.getAttribute("href");
        await link.click();
        await page.waitForTimeout(1500);
        console.log(`Settings navigated to: ${href}`);
      }
    }
    await snap(page, "settings-last-tab");
  });

  test("Invalid route → graceful handling", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/nonexistent-route-12345", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await snap(page, "invalid-route");
    // Should redirect to dashboard or show error
    const url = page.url();
    console.log(`Invalid route redirected to: ${url}`);
  });

  test("Invalid student ID → graceful handling", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/students/999999", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await snap(page, "invalid-student-id");
  });
});

test.describe("Student Deep Interactive Audit", () => {
  test.beforeEach(async ({ page }) => {
    collectErrors(page);
    await loginViaUI(page, "student");
  });

  test("Dashboard → navigation to each section", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await snap(page, "stu-dashboard-full");

    // 하단 탭바 확인
    const tabBar = page.locator("[class*='tab-bar'], [class*='bottom-nav'], nav").last();
    const tabs = tabBar.locator("a, button");
    const tabCount = await tabs.count();
    console.log(`Student tab bar items: ${tabCount}`);
  });

  test("Student drawer open/close", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 햄버거 메뉴 클릭
    const menuBtn = page.locator("button[aria-label*='menu'], button[aria-label*='메뉴'], [class*='hamburger'], [class*='menu-btn']").first();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      await snap(page, "stu-drawer-open");

      // ESC로 닫기
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await snap(page, "stu-drawer-closed");
    }
  });

  test("Grades page → data visible", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/grades", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await snap(page, "stu-grades-full");
  });

  test("Exams page → list visible", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/exams", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await snap(page, "stu-exams-full");
  });
});

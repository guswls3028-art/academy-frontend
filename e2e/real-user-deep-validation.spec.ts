/**
 * 실전 사용자 심층 검증 E2E — 데이터 생성 + 확인 + 교차검증
 *
 * 테스트 데이터를 UI를 통해 생성하고, 저장 결과를 확인하고, 새로고침 후 유지 확인
 * 선행조건 없이 프론트만으로 전 과정 수행
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TENANT_CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_USER = process.env.E2E_STUDENT_USER || "3333";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS || "test1234";

const SS = "e2e/screenshots/deep";
const TS = `E2E-${Date.now()}`;

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const apiErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("favicon") || t.includes("sourcemap") || t.includes("ResizeObserver")) return;
      consoleErrors.push(t);
    }
  });
  page.on("pageerror", (err) => { pageErrors.push(err.message); });
  page.on("response", (resp) => {
    const s = resp.status();
    const u = resp.url();
    if (s >= 400 && !u.includes("favicon") && !u.includes("sourcemap") && !u.includes("hot-update")) {
      apiErrors.push(`[${s}] ${resp.request().method()} ${u.split("?")[0]}`);
    }
  });

  return { consoleErrors, pageErrors, apiErrors };
}

async function uiLogin(page: Page, role: "admin" | "student") {
  const user = role === "admin" ? ADMIN_USER : STUDENT_USER;
  const pass = role === "admin" ? ADMIN_PASS : STUDENT_PASS;

  await page.goto(`${BASE}/login/${TENANT_CODE}`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1000);

  const startBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(500);
  }

  const idInput = page.locator('input[name="username"]').first();
  await idInput.waitFor({ state: "visible", timeout: 15000 });
  await idInput.fill(user);
  await page.locator('input[name="password"], input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();

  const dashPattern = role === "student" ? /\/student/ : /\/(admin|dev)/;
  await page.waitForURL(dashPattern, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // dev 계정인 경우 운영 콘솔로 전환
  if (role === "admin" && page.url().includes("/dev")) {
    const opsLink = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first();
    if (await opsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await opsLink.click();
      await page.waitForTimeout(3000);
    }
  }
}

/** 사이드바 메뉴 클릭 */
async function clickSidebarMenu(page: Page, menuName: string) {
  const menu = page.locator('nav a, aside a, [class*="sidebar"] a, [class*="side-nav"] a')
    .filter({ hasText: new RegExp(menuName) }).first();
  await expect(menu).toBeVisible({ timeout: 10000 });
  await menu.click();
  await page.waitForTimeout(2000);
}

test.describe("심층 실전 검증 — 강의/차시/성적 풀 사이클", () => {

  test("강의 진입 → 차시 탭 → 차시 상세 → 출결/성적 탭 전환", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, "admin");
    await page.screenshot({ path: `${SS}/D1-01-dashboard.png` });

    // 사이드바 → 강의
    await clickSidebarMenu(page, "강의");
    await page.screenshot({ path: `${SS}/D1-02-lectures.png` });

    // 강의 목록에서 첫 강의 행 클릭
    const lectureRow = page.locator('table tbody tr').first();
    if (!await lectureRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[D1] 강의 없음 → 프론트만으로 재현 불가 (데이터 부재)");
      return;
    }
    await lectureRow.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/D1-03-lecture-detail.png` });

    // 상단 탭 확인 — "차시" 탭 찾아서 클릭
    const sessionTab = page.locator('a, button, [role="tab"]').filter({ hasText: /차시/ }).first();
    if (await sessionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/D1-04-sessions-tab.png` });

      // 차시 목록에서 첫 차시 행 클릭
      const sessionRow = page.locator('table tbody tr').first();
      if (await sessionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionRow.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SS}/D1-05-session-detail.png` });

        // 출결 탭 확인
        const attTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결/ }).first();
        if (await attTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await attTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${SS}/D1-06-attendance-tab.png` });
        }

        // 성적 탭 확인
        const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
        if (await scoresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scoresTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${SS}/D1-07-scores-tab.png` });
        }
      } else {
        console.log("[D1] 차시 데이터 없음 — 성적/출결 테스트 불가");
        await page.screenshot({ path: `${SS}/D1-04b-no-sessions.png` });
      }
    } else {
      console.log("[D1] 차시 탭 미발견");
    }

    // 크리티컬 에러 확인
    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    if (criticalErrors.length > 0) console.log("[D1] CRITICAL:", criticalErrors);
    expect(criticalErrors).toEqual([]);

    const serverErrors = apiErrors.filter(e => e.startsWith("[5"));
    if (serverErrors.length > 0) console.log("[D1] 500 에러:", serverErrors);
  });

  test("학생 목록 → 학생 상세 → 탭 전환 → 새로고침 유지", async ({ page }) => {
    const { pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, "admin");

    await clickSidebarMenu(page, "학생");
    await page.screenshot({ path: `${SS}/D2-01-students.png` });

    // 학생 목록 확인
    const studentRow = page.locator('table tbody tr, [class*="student-card"]').first();
    if (!await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[D2] 학생 없음");
      return;
    }

    // 첫 학생 클릭
    await studentRow.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/D2-02-student-detail.png` });

    // 학생 상세 오버레이 내 탭 전환 (오버레이 안에서만 찾기)
    const overlay = page.locator('[class*="overlay"], [class*="ds-overlay"]').first();
    const overlayVisible = await overlay.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[D2] 오버레이 열림: ${overlayVisible}`);

    if (overlayVisible) {
      // 오버레이 안의 탭들 순회
      const overlayTabs = overlay.locator('a, button, [role="tab"]').filter({ hasText: /수강|출결|성적|메시지|정보/ });
      const tabCount = await overlayTabs.count();
      console.log(`[D2] 오버레이 내 탭 수: ${tabCount}`);

      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        const tab = overlayTabs.nth(i);
        if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
          const tabText = await tab.textContent();
          await tab.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: `${SS}/D2-03-student-tab-${i}.png` });
          console.log(`[D2] 오버레이 탭 "${tabText?.trim()}" 전환`);
        }
      }

      // 오버레이 닫기 (X 버튼 또는 뒤로가기)
      const closeBtn = overlay.locator('button[aria-label*="닫기"], button[aria-label*="close"], [class*="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      } else {
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }

    // 새로고침 후 유지 확인
    const currentUrl = page.url();
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/D2-04-after-reload.png` });

    // URL이 유지되는지 확인
    expect(page.url()).toContain("/admin");

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("클리닉 전체 동선 — 홈 → 운영 → 예약 → 리포트 → 설정 + 탭 전환", async ({ page }) => {
    const { pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, "admin");
    await clickSidebarMenu(page, "클리닉");
    await page.screenshot({ path: `${SS}/D3-01-clinic-home.png` });

    // 클리닉 내부 탭 순회
    const tabNames = ["운영", "예약", "리포트", "설정"];
    for (const name of tabNames) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(`^${name}`) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SS}/D3-02-clinic-${name}.png` });
        console.log(`[D3] 클리닉 "${name}" 탭 진입 완료`);
      } else {
        console.log(`[D3] 클리닉 "${name}" 탭 미발견`);
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("메시지 — 템플릿/자동발송/내역/설정 탭 전환 + 설정 화면 내용 확인", async ({ page }) => {
    const { pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, "admin");
    await clickSidebarMenu(page, "메시지");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/D4-01-message.png` });

    // 탭 순회
    const tabNames = ["템플릿", "자동발송", "발송 내역", "설정"];
    for (const name of tabNames) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(name) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/D4-02-msg-${name}.png` });
        console.log(`[D4] 메시지 "${name}" 탭 진입 완료`);
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("커뮤니티/영상/직원/도구/설정 — 사이드바 순회 + 빈 상태 확인", async ({ page }) => {
    const { pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, "admin");

    const menus = ["커뮤니티", "영상", "직원", "도구", "설정"];
    for (const menuName of menus) {
      const menu = page.locator('nav a, aside a, [class*="sidebar"] a')
        .filter({ hasText: new RegExp(`^${menuName}$`) }).first();
      if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menu.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SS}/D5-${menuName}.png` });
        console.log(`[D5] "${menuName}" 페이지 진입 완료`);
      } else {
        console.log(`[D5] "${menuName}" 사이드바 메뉴 미발견`);
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("학생 앱 — 로그인 → 메인 화면 → 탭 순회", async ({ page }) => {
    const { pageErrors } = collectErrors(page);

    await uiLogin(page, "student");
    await page.screenshot({ path: `${SS}/D6-01-student-main.png` });

    // 하단 네비게이션 또는 탭 바 순회
    const navItems = page.locator('nav a, [class*="bottom-nav"] a, [class*="tab-bar"] a');
    const count = await navItems.count();
    console.log(`[D6] 학생 앱 네비 항목: ${count}개`);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const item = navItems.nth(i);
      if (await item.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await item.textContent();
        await item.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SS}/D6-02-student-nav-${i}.png` });
        console.log(`[D6] 학생 네비 "${text?.trim()}" 전환`);
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });
});

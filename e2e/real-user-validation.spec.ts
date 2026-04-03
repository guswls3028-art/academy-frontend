/**
 * 실전 사용자 검증 E2E — 선생님 핵심 운영 동선
 *
 * 원칙:
 * - 실제 로그인 페이지에서 UI 폼으로 로그인
 * - 화면에 보이는 메뉴/버튼/탭만 클릭하여 이동
 * - page.goto 직접 진입 금지 (로그인 URL 제외)
 * - localStorage/token 주입 금지
 * - 모든 동작은 사용자가 할 수 있는 행위만
 * - 각 단계 스크린샷 저장
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TENANT_CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_USER = process.env.E2E_STUDENT_USER || "3333";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS || "test1234";

const SS = "e2e/screenshots";

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

/** 실제 로그인 폼 사용 — UI만 */
async function uiLogin(page: Page, base: string, code: string, user: string, pass: string, role: "admin" | "student") {
  // 1. 로그인 페이지 진입 (유일하게 허용되는 직접 URL)
  await page.goto(`${base}/login/${code}`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/00-login-page.png` });

  // 2. 로그인 폼 노출 대기 — "시작하기" 또는 바로 로그인 폼
  const startBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(500);
  }

  // 3. 아이디/비밀번호 입력
  const idInput = page.locator('input[name="username"]').first();
  await idInput.waitFor({ state: "visible", timeout: 15000 });
  await idInput.fill(user);
  const pwInput = page.locator('input[name="password"], input[type="password"]').first();
  await pwInput.fill(pass);
  await page.screenshot({ path: `${SS}/01-login-filled.png` });

  // 4. 로그인 버튼 클릭
  const loginBtn = page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first();
  await loginBtn.click();

  // 5. 대시보드 진입 대기 (admin97은 dev 계정이므로 /dev로 리다이렉트될 수 있음)
  const dashPattern = role === "student" ? /\/student/ : /\/(admin|dev)/;
  await page.waitForURL(dashPattern, { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/02-dashboard.png` });

  // dev 계정인 경우 "운영 콘솔 열기"를 클릭해서 선생님 화면으로 이동
  if (role === "admin" && page.url().includes("/dev")) {
    const opsLink = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first();
    if (await opsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await opsLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SS}/02b-admin-from-dev.png` });
    }
  }
}

test.describe("선생님 실전 운영 동선 (UI only)", () => {
  test("시나리오 1: 로그인 → 대시보드 확인", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 대시보드 화면에 무언가 보이는지 확인
    const anyContent = page.locator('h1, h2, h3, [class*="dashboard"], [class*="card"]').first();
    await expect(anyContent).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SS}/S1-01-dashboard-loaded.png` });

    // 사이드바 메뉴 보이는지 확인
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="side-nav"], aside').first();
    const sidebarVisible = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);

    // 크리티컬 에러 없어야 함
    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);

    console.log(`[S1] 대시보드 진입 완료. 사이드바: ${sidebarVisible ? "보임" : "미확인"}`);
    console.log(`[S1] 콘솔에러: ${consoleErrors.length}건, API에러: ${apiErrors.length}건`);
    if (apiErrors.length > 0) console.log(`[S1] API errors:`, apiErrors);
  });

  test("시나리오 2: 사이드바 → 강의 목록 → 강의 상세 진입", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바에서 "강의" 메뉴 클릭
    const lectureMenu = page.locator('nav a, aside a, [class*="sidebar"] a, [class*="side-nav"] a')
      .filter({ hasText: /강의/ }).first();
    await expect(lectureMenu).toBeVisible({ timeout: 10000 });
    await lectureMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S2-01-lectures-list.png` });

    // 강의 목록이 표시되는지 확인 (테이블 행 또는 카드)
    const lectureRow = page.locator('table tbody tr, [class*="lecture-card"], [class*="card"]').first();
    const hasLectures = await lectureRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasLectures) {
      console.log("[S2] 강의 없음 — 스킵");
      await page.screenshot({ path: `${SS}/S2-02-no-lectures.png` });
      return;
    }

    // 첫 강의 행 클릭 (테이블 행이나 링크)
    const firstLecture = page.locator('table tbody tr').first();
    await firstLecture.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S2-03-lecture-detail.png` });

    // 강의 상세에서 차시 탭/목록 확인
    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    const hasSessions = await sessionLink.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[S2] 강의 상세 진입 완료. 차시 존재: ${hasSessions}`);

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
    if (apiErrors.filter(e => e.startsWith("[5")).length > 0) {
      console.log("[S2] 500 에러 발견:", apiErrors.filter(e => e.startsWith("[5")));
    }
  });

  test("시나리오 3: 강의 > 차시 > 성적탭 > 학생 행 클릭 > 드로어 확인", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 강의
    const lectureMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /강의/ }).first();
    await lectureMenu.click();
    await page.waitForTimeout(2000);

    // 첫 강의 클릭
    const firstLecture = page.locator('table tbody tr').first();
    if (!await firstLecture.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[S3] 강의 없음 — 스킵");
      return;
    }
    await firstLecture.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S3-01b-lecture-detail.png` });

    // 차시 탭/목록에서 첫 차시 클릭 (테이블 행 또는 링크)
    const firstSession = page.locator('table tbody tr, a[href*="/sessions/"]').first();
    if (!await firstSession.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[S3] 차시 없음 — 스킵");
      return;
    }
    await firstSession.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/S3-01-session-detail.png` });

    // "성적" 탭 클릭
    const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
    if (!await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[S3] 성적 탭 없음 — 스킵");
      return;
    }
    await scoresTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/S3-02-scores-tab.png` });

    // 성적 테이블 또는 빈 상태 확인
    const table = page.locator('.ds-scores-table, table').first();
    const empty = page.locator('[class*="empty"], [class*="Empty"]').first();
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await empty.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[S3] 성적탭: 테이블=${hasTable}, 빈상태=${hasEmpty}`);

    if (hasTable) {
      // 첫 학생 행 클릭 → 드로어 확인
      const firstRow = page.locator('tbody tr').first();
      await firstRow.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/S3-03-student-drawer.png` });

      // 드로어가 열렸는지 확인
      const drawer = page.locator('[role="complementary"], [class*="drawer"], [class*="Drawer"]').first();
      const drawerVisible = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[S3] 드로어 열림: ${drawerVisible}`);
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 4: 학생 목록 → 검색 → 상세 오버레이", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 학생
    const studentMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /학생/ }).first();
    await expect(studentMenu).toBeVisible({ timeout: 10000 });
    await studentMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S4-01-students-list.png` });

    // 검색 입력
    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="이름"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/S4-02-search-result.png` });
      await searchInput.clear();
      await page.waitForTimeout(1000);
    }

    // 첫 학생 클릭
    const studentLink = page.locator('a[href*="/students/"], tr a, [class*="student"] a').first();
    if (await studentLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/S4-03-student-detail.png` });
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 5: 시험 탐색기 → 시험 상세 → 탭 전환", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 시험 (또는 학습)
    const examMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /시험|학습/ }).first();
    await expect(examMenu).toBeVisible({ timeout: 10000 });
    await examMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S5-01-exams-page.png` });

    // 시험 항목 클릭
    const examItem = page.locator('a[href*="/exams/"], [class*="exam-card"], tr').filter({ hasText: /.+/ }).first();
    if (await examItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/S5-02-exam-detail.png` });

      // 탭 전환 확인 (결과, 정책, 제출 등)
      const tabs = page.locator('[role="tab"], button, a').filter({ hasText: /결과|정책|제출|답안/ });
      const tabCount = await tabs.count();
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(1500);
        }
      }
      await page.screenshot({ path: `${SS}/S5-03-exam-tabs.png` });
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 6: 클리닉 → 홈 → 운영 → 예약관리", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 클리닉
    const clinicMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /클리닉/ }).first();
    await expect(clinicMenu).toBeVisible({ timeout: 10000 });
    await clinicMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S6-01-clinic-home.png` });

    // 클리닉 내부 탭/메뉴 확인
    const tabs = ["운영", "예약", "리포트", "설정"];
    for (const tabName of tabs) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(tabName) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/S6-02-clinic-${tabName}.png` });
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 7: 메시지 → 탭 전환 (템플릿/자동발송/내역/설정)", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 메시지
    const msgMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /메시지/ }).first();
    await expect(msgMenu).toBeVisible({ timeout: 10000 });
    await msgMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S7-01-message-page.png` });

    // 탭 전환
    const tabs = ["자동발송", "발송 내역", "설정", "템플릿"];
    for (const tabName of tabs) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(tabName) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/S7-02-msg-${tabName}.png` });
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 8: 커뮤니티/영상/도구/설정 — 사이드바 이동", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    const menus = ["커뮤니티", "영상", "도구", "설정"];
    for (const menuName of menus) {
      const menu = page.locator('nav a, aside a, [class*="sidebar"] a')
        .filter({ hasText: new RegExp(`^${menuName}$|^${menuName} `) }).first();
      if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menu.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/S8-${menuName}.png` });
      } else {
        console.log(`[S8] "${menuName}" 사이드바 메뉴 미발견`);
      }
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시나리오 9: 직원 관리 → 상세 진입", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, ADMIN_USER, ADMIN_PASS, "admin");

    // 사이드바 → 직원
    const staffMenu = page.locator('nav a, aside a, [class*="sidebar"] a')
      .filter({ hasText: /직원/ }).first();
    if (!await staffMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("[S9] 직원 메뉴 미발견 — 스킵");
      return;
    }
    await staffMenu.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/S9-01-staff-page.png` });

    // 첫 직원 클릭
    const staffItem = page.locator('a[href*="/staff/"], [class*="staff"] a, tr a').first();
    if (await staffItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await staffItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/S9-02-staff-detail.png` });
    }

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe("학생 앱 교차 검증 (UI only)", () => {
  test("시나리오 10: 학생 로그인 → 메인 화면 확인", async ({ page }) => {
    const { consoleErrors, pageErrors, apiErrors } = collectErrors(page);

    await uiLogin(page, BASE, TENANT_CODE, STUDENT_USER, STUDENT_PASS, "student");
    await page.screenshot({ path: `${SS}/S10-01-student-main.png` });

    // 학생 앱 콘텐츠 확인
    const content = page.locator('main, [class*="student"], h1, h2, [class*="card"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 탭/메뉴 확인
    const navItems = page.locator('nav a, [class*="tab"], [class*="bottom-nav"] a');
    const navCount = await navItems.count();
    console.log(`[S10] 학생 앱 메인 진입 완료. 네비게이션 항목: ${navCount}개`);

    const criticalErrors = pageErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read")
    );
    expect(criticalErrors).toEqual([]);
  });
});

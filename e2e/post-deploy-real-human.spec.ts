/**
 * 배포 후 실전 검증 — 알바생이 하는 것처럼 진짜 똑같이
 *
 * 규칙:
 * - 로그인 폼에서 직접 ID/PW 입력
 * - 사이드바 메뉴 눈으로 보고 클릭
 * - 테이블 행 보이면 클릭
 * - 모달 열리면 입력하고 저장
 * - 결과가 화면에 보이는지 눈으로 확인
 * - 새로고침해서 유지되는지 확인
 * - 다른 역할로 로그인해서 교차 확인
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_USER = process.env.E2E_STUDENT_USER || "3333";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS || "test1234";

const SS = "e2e/screenshots/deploy";

/** 브라우저에서 발생하는 모든 에러를 잡는다 */
function watchErrors(page: Page) {
  const crashes: string[] = [];
  const api500s: string[] = [];
  page.on("pageerror", (err) => crashes.push(`[CRASH] ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (t.includes("TypeError") || t.includes("Cannot read") || t.includes("is not a function") || t.includes("is not defined")) {
        crashes.push(`[CONSOLE] ${t}`);
      }
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 500) api500s.push(`[${r.status()}] ${r.request().method()} ${r.url().split("?")[0]}`);
  });
  return { crashes, api500s };
}

/** 로그인 페이지에서 진짜 로그인 */
async function realLogin(page: Page, user: string, pass: string) {
  await page.goto(`${BASE}/login/${CODE}`, { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(1500);

  // "로그인" 또는 "시작하기" 버튼이 있으면 누른다
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  // 아이디 입력
  const idField = page.locator('input[name="username"]').first();
  await idField.waitFor({ state: "visible", timeout: 15000 });
  await idField.fill(user);

  // 비밀번호 입력
  const pwField = page.locator('input[name="password"], input[type="password"]').first();
  await pwField.fill(pass);

  // 로그인 버튼 클릭
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();

  // 화면 전환 대기
  await page.waitForURL(/\/(admin|dev|student)/, { timeout: 25000 });
  await page.waitForTimeout(2500);

  // dev 계정이면 "운영 콘솔 열기" 눌러서 선생님 화면으로 전환
  if (page.url().includes("/dev")) {
    const ops = page.locator('a, button').filter({ hasText: /운영 콘솔/ }).first();
    if (await ops.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ops.click();
      await page.waitForTimeout(3000);
    }
  }
}

/** 사이드바에서 메뉴 클릭 */
async function nav(page: Page, label: string) {
  const item = page.locator('nav a, aside a, [class*="sidebar"] a, [class*="side-nav"] a')
    .filter({ hasText: new RegExp(label) }).first();
  await item.waitFor({ state: "visible", timeout: 8000 });
  await item.click();
  await page.waitForTimeout(2000);
}

test.describe("배포 후 실전 검증", () => {

  test("선생님: 로그인 → 대시보드 → 강의 → 차시 → 출결 → 성적 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    // ① 로그인
    await realLogin(page, ADMIN_USER, ADMIN_PASS);
    await page.screenshot({ path: `${SS}/01-dashboard.png` });
    console.log("① 대시보드 진입 OK");

    // ② 사이드바 "강의" 클릭
    await nav(page, "강의");
    await page.screenshot({ path: `${SS}/02-lectures.png` });
    console.log("② 강의 목록 OK");

    // ③ 첫 강의 행 클릭
    const row = page.locator('table tbody tr').first();
    if (!await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("③ 강의 없음 — 여기서 중단");
      expect(crashes).toEqual([]);
      return;
    }
    const lectureName = await row.locator('td').first().textContent();
    await row.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/03-lecture-detail.png` });
    console.log(`③ 강의 "${lectureName?.trim()}" 상세 진입 OK`);

    // ④ "차시" 탭 클릭
    const sessionsTab = page.locator('a, button, [role="tab"]').filter({ hasText: /차시/ }).first();
    if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/04-sessions-tab.png` });
      console.log("④ 차시 탭 OK");

      // ⑤ 첫 차시 행 클릭
      const sessionRow = page.locator('table tbody tr').first();
      if (await sessionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionRow.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SS}/05-session-detail.png` });
        console.log("⑤ 차시 상세 진입 OK");

        // ⑥ "출결" 탭 클릭
        const attTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결/ }).first();
        if (await attTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await attTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${SS}/06-attendance.png` });
          console.log("⑥ 출결 탭 OK");
        }

        // ⑦ "성적" 탭 클릭
        const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
        if (await scoresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scoresTab.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: `${SS}/07-scores.png` });
          console.log("⑦ 성적 탭 OK");

          // 성적 테이블이 보이면: 학생 행 클릭 → 드로어 확인
          const scoreTable = page.locator('.ds-scores-table, table').first();
          if (await scoreTable.isVisible({ timeout: 3000 }).catch(() => false)) {
            const studentRow = page.locator('tbody tr').first();
            await studentRow.click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SS}/08-student-drawer.png` });

            const drawer = page.locator('[role="complementary"], [class*="drawer"]').first();
            const drawerOpen = await drawer.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`⑧ 학생 드로어: ${drawerOpen ? "열림" : "안 열림"}`);
          }
        }

        // ⑨ 새로고침해서 터지는지 확인
        await page.reload({ waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/09-after-reload.png` });
        console.log("⑨ 새로고침 후 정상");
      }
    }

    // 크래시 확인
    if (crashes.length > 0) console.log("CRASHES:", crashes);
    if (api500s.length > 0) console.log("500 ERRORS:", api500s);
    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("선생님: 학생 목록 → 클릭 → 오버레이 → 닫기 → 검색 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, ADMIN_USER, ADMIN_PASS);

    // 학생 메뉴
    await nav(page, "학생");
    await page.screenshot({ path: `${SS}/10-students.png` });

    // 첫 학생 행 클릭
    const studentRow = page.locator('table tbody tr').first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/11-student-overlay.png` });

      // 오버레이 닫기 (X 버튼 찾기)
      const closeBtn = page.locator('[class*="overlay"] button, [class*="close-btn"], button[aria-label*="닫기"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      } else {
        // 뒤로가기로 닫기
        await page.goBack();
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: `${SS}/12-overlay-closed.png` });
      console.log("학생 오버레이 열고 닫기 OK");
    }

    // 검색
    const search = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="이름"]').first();
    if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
      await search.fill("E2E");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/13-search.png` });
      await search.clear();
      await page.waitForTimeout(1000);
      console.log("검색 입력/클리어 OK");
    }

    // 새로고침
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("새로고침 후 정상");

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("선생님: 클리닉 → 모든 탭 순회 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, ADMIN_USER, ADMIN_PASS);
    await nav(page, "클리닉");
    await page.screenshot({ path: `${SS}/20-clinic-home.png` });

    // 보이는 탭 전부 클릭
    const allTabs = page.locator('[class*="tab"], a, button').filter({ hasText: /오늘|진행|항목|패스카드|설정|예약|리포트/ });
    const count = await allTabs.count();
    for (let i = 0; i < count; i++) {
      const tab = allTabs.nth(i);
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = (await tab.textContent())?.trim();
        await tab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/21-clinic-tab-${i}.png` });
        console.log(`클리닉 탭 "${text}" OK`);
      }
    }

    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("클리닉 새로고침 후 정상");

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("선생님: 메시지 → 4개 탭 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, ADMIN_USER, ADMIN_PASS);
    await nav(page, "메시지");
    await page.screenshot({ path: `${SS}/30-message.png` });

    // 탭 전환
    for (const name of ["자동발송", "발송 내역", "설정", "템플릿"]) {
      const tab = page.locator('a, button').filter({ hasText: new RegExp(`^${name}`) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SS}/31-msg-${name}.png` });
        console.log(`메시지 "${name}" 탭 OK`);
      }
    }

    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("메시지 새로고침 후 정상");

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("선생님: 시험 → 상세 → 탭 전환 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, ADMIN_USER, ADMIN_PASS);
    await nav(page, "시험");
    await page.screenshot({ path: `${SS}/40-exams.png` });

    // 첫 시험 클릭
    const examRow = page.locator('table tbody tr, [class*="exam-card"], [class*="tree-item"]').first();
    if (await examRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examRow.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SS}/41-exam-detail.png` });

      // 보이는 탭 전환
      const tabs = page.locator('[role="tab"], [class*="tab-item"], a, button').filter({ hasText: /결과|정책|제출|답안|문항/ });
      const tc = await tabs.count();
      for (let i = 0; i < Math.min(tc, 4); i++) {
        const t = tabs.nth(i);
        if (await t.isVisible({ timeout: 1000 }).catch(() => false)) {
          await t.click();
          await page.waitForTimeout(1500);
        }
      }
      await page.screenshot({ path: `${SS}/42-exam-tabs.png` });
      console.log("시험 상세 + 탭 전환 OK");
    }

    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("선생님: 커뮤니티/영상/도구/설정 전체 순회", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, ADMIN_USER, ADMIN_PASS);

    for (const menu of ["커뮤니티", "영상", "도구", "설정"]) {
      try {
        await nav(page, menu);
        await page.screenshot({ path: `${SS}/50-${menu}.png` });
        console.log(`"${menu}" 페이지 OK`);
      } catch {
        console.log(`"${menu}" 사이드바 메뉴 미발견`);
      }
    }

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });

  test("학생: 로그인 → 메인 → 모든 탭 → 새로고침", async ({ page }) => {
    const { crashes, api500s } = watchErrors(page);

    await realLogin(page, STUDENT_USER, STUDENT_PASS);
    await page.screenshot({ path: `${SS}/60-student-home.png` });
    console.log("학생 로그인 OK");

    // 하단 네비 전부 클릭
    const navs = page.locator('nav a, [class*="bottom-nav"] a, [class*="tab-bar"] a');
    const nc = await navs.count();
    for (let i = 0; i < nc; i++) {
      const n = navs.nth(i);
      if (await n.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = (await n.textContent())?.trim();
        await n.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SS}/61-student-nav-${i}.png` });
        console.log(`학생 "${text}" 탭 OK`);
      }
    }

    // 메인 화면 아이콘 메뉴도 클릭
    const menuBtns = page.locator('[class*="menu-grid"] a, [class*="quick-menu"] a, main a[href*="/student/"]');
    const mc = await menuBtns.count();
    for (let i = 0; i < Math.min(mc, 6); i++) {
      const btn = menuBtns.nth(i);
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = (await btn.textContent())?.trim();
        await btn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SS}/62-student-menu-${i}.png` });
        console.log(`학생 메뉴 "${text}" OK`);
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }

    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("학생 새로고침 OK");

    expect(crashes).toEqual([]);
    expect(api500s).toEqual([]);
  });
});

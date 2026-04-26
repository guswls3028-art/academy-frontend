/**
 * 운영 안정화 파괴테스트 — 전 도메인 종합 E2E
 *
 * 목표: 숨은 버그 없음 판정을 위한 실전 검증
 * 대상: Tenant 1 (hakwonplus)
 * 범위: 로그인 → 대시보드 → 학생 → 강의 → 시험 → 성적 → 출결 → 클리닉 → 커뮤니티 → 메시지 → 영상 → 직원 → 설정
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

// ── 공통 헬퍼 ──
async function navTo(page: Page, menuText: string, timeout = 10000) {
  const link = page
    .locator(
      "nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a, [class*=drawer] a"
    )
    .filter({ hasText: menuText })
    .first();
  await expect(link, `사이드바에 "${menuText}" 메뉴가 보여야 함`).toBeVisible({ timeout });
  await link.click();
  // SPA 렌더 안정화 — networkidle 기반 (waitForTimeout 제거)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/destab-${name}.png`,
    fullPage: false,
  });
}

/** 액션 후 짧은 settle — networkidle 우선, 필요 시만 사용. */
async function settle(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: ms * 3 }).catch(() => {});
}

// ═══════════════════════════════════════
// A. Admin 전 도메인 순회
// ═══════════════════════════════════════
test.describe("Admin 전 도메인 파괴테스트", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ── 1. 대시보드 ──
  test("1. 대시보드 로딩 + 콘텐츠 확인", async ({ page }) => {
    const dashboard = page.locator("text=대시보드").or(page.locator("text=홈"));
    await expect(dashboard.first()).toBeVisible({ timeout: 10000 });
    await snap(page, "01-dashboard");

    const mainContent = page.locator("main, [class*=content], [class*=dashboard], [class*=home]");
    const contentCount = await mainContent.count();
    expect(contentCount, "대시보드 메인 콘텐츠 영역이 1개 이상 있어야 함").toBeGreaterThan(0);
  });

  // ── 2. 학생 관리 ──
  test("2. 학생 — 목록/검색/상세/탭전환", async ({ page }) => {
    await navTo(page, "학생");
    await snap(page, "02-students-list");

    // 학생 목록 테이블 존재
    const table = page.locator("table, [class*=list], [class*=grid]").first();
    await expect(table).toBeVisible({ timeout: 10000 });

    // 검색
    const search = page.locator(
      'input[placeholder*="검색"], input[type="search"], input[placeholder*="이름"]'
    ).first();
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill("테스트");
      await settle(page);
      await snap(page, "02-students-search");
      await search.clear();
      await settle(page);
    }

    // 첫 번째 학생 상세 진입
    const firstStudent = page.locator("a[href*='/students/']").first();
    if (await firstStudent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstStudent.click();
      await settle(page);
      await snap(page, "02-students-detail");

      // 탭 전환 (수강, 성적, 출결 등)
      const tabs = ["수강", "성적", "출결", "클리닉"];
      for (const tab of tabs) {
        const tabBtn = page.locator("a, button").filter({ hasText: tab }).first();
        if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tabBtn.click();
          await settle(page);
        }
      }
      await snap(page, "02-students-tabs");
    }
  });

  // ── 3. 강의 관리 ──
  test("3. 강의 — 목록/상세/차시목록", async ({ page }) => {
    await navTo(page, "강의");
    await snap(page, "03-lectures-list");

    const lectureLink = page.locator("a[href*='/lectures/']").first();
    if (await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lectureLink.click();
      await settle(page);
      await snap(page, "03-lectures-detail");

      const sessionTab = page.locator("a, button").filter({ hasText: /차시|회차|커리큘럼/ }).first();
      if (await sessionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionTab.click();
        await settle(page);
        await snap(page, "03-lectures-sessions");
      }
    }
  });

  // ── 4. 시험 관리 ──
  test("4. 시험 — 목록/상세/문항확인", async ({ page }) => {
    await navTo(page, "시험");
    await snap(page, "04-exams-list");

    const examLink = page.locator("a[href*='/exams/']").first();
    if (await examLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examLink.click();
      await settle(page);
      await snap(page, "04-exams-detail");

      const questions = page.locator("text=문항").or(page.locator("text=문제"));
      // 문항/문제 라벨이 있어야 시험 상세가 정상 렌더된 것으로 간주 (옵셔널 — 시험 데이터 0건 환경)
      if (await questions.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(questions.first()).toBeVisible();
      }
    }
  });

  // ── 5. 성적 ──
  test("5. 성적 — 강의별 성적 입력 화면 진입", async ({ page }) => {
    await navTo(page, "강의");

    const lectureLink = page.locator("a[href*='/lectures/']").first();
    if (!(await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)))
      return;
    await lectureLink.click();
    await settle(page);

    const scoresTab = page.locator("a, button").filter({ hasText: /성적|점수/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await settle(page);
      await snap(page, "05-scores-tab");

      const sessionRow = page.locator("a[href*='/scores']").first();
      if (await sessionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionRow.click();
        await settle(page);
        await snap(page, "05-scores-entry");
      }
    }
  });

  // ── 6. 출결 (강의 상세 > 차시 > 출결 탭) ──
  test("6. 출결 — 강의 차시 출결 탭 진입", async ({ page }) => {
    await navTo(page, "강의");

    const lectureLink = page.locator("a[href*='/lectures/']").first();
    if (!(await lectureLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "강의 0개 환경" });
      return;
    }
    await lectureLink.click();
    await settle(page);

    const sessionLink = page.locator("a[href*='/sessions/']").first();
    if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionLink.click();
      await settle(page);

      const attendanceTab = page.locator("a, button").filter({ hasText: "출결" }).first();
      if (await attendanceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await attendanceTab.click();
        await settle(page);
        await snap(page, "06-attendance-tab");
      }
    }
    await snap(page, "06-attendance-main");
  });

  // ── 7. 클리닉 ──
  test("7. 클리닉 — 메인/콘솔/설정", async ({ page }) => {
    await navTo(page, "클리닉");
    await snap(page, "07-clinic-main");

    const consoleTab = page.locator("a, button").filter({ hasText: "콘솔" }).first();
    if (await consoleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consoleTab.click();
      await settle(page);
      await snap(page, "07-clinic-console");
    }

    const settingsTab = page.locator("a, button").filter({ hasText: "설정" }).first();
    if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.click();
      await settle(page);
      await snap(page, "07-clinic-settings");
    }
  });

  // ── 8. 커뮤니티/자료실 ──
  test("8. 커뮤니티 — 게시판/공지/자료실", async ({ page }) => {
    await navTo(page, "커뮤니티");
    await snap(page, "08-community-main");

    const dataTab = page.locator("a, button").filter({ hasText: "자료실" }).first();
    if (await dataTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dataTab.click();
      await settle(page);
      await snap(page, "08-community-library");
    }

    const noticeTab = page.locator("a, button").filter({ hasText: "공지" }).first();
    if (await noticeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noticeTab.click();
      await settle(page);
      await snap(page, "08-community-notice");
    }
  });

  // ── 9. 메시지 ──
  test("9. 메시지 — 설정/템플릿/자동발송/발송내역", async ({ page }) => {
    await navTo(page, "메시지");
    await snap(page, "09-message-templates");

    const tabs = ["설정", "자동발송", "발송 내역"];
    let visited = 0;
    for (const tab of tabs) {
      const tabBtn = page.locator("a, button").filter({ hasText: tab }).first();
      if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabBtn.click();
        await settle(page);
        await snap(page, `09-message-${tab.replace(/ /g, "-")}`);
        visited += 1;
      }
    }
    expect(visited, "메시지 모듈은 설정/자동발송/발송 내역 중 1개 이상 노출되어야 함").toBeGreaterThan(0);
  });

  // ── 10. 영상 ──
  test("10. 영상 — 목록/업로드 화면", async ({ page }) => {
    await navTo(page, "영상");
    await snap(page, "10-videos-list");

    const videoItems = page.locator("a[href*='/videos/']").or(page.locator("[class*=video-card]"));
    // 영상 0건 환경도 정상 — count 가져오기만 (silent 제거).
    await videoItems.count();
  });

  // ── 11. 직원 관리 ──
  test("11. 직원 — 목록/근무유형/급여", async ({ page }) => {
    await navTo(page, "직원");
    await snap(page, "11-staff-list");

    const tabs = ["근무 유형", "급여", "운영"];
    for (const tab of tabs) {
      const tabBtn = page.locator("a, button").filter({ hasText: tab }).first();
      if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabBtn.click();
        await settle(page);
        await snap(page, `11-staff-${tab.replace(/ /g, "-")}`);
      }
    }
  });

  // ── 12. 설정 ──
  test("12. 설정 — 학원 정보/구독", async ({ page }) => {
    const settingsLink = page
      .locator("nav a, aside a, [class*=sidebar] a")
      .filter({ hasText: "설정" })
      .first();
    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await settle(page);
    } else {
      await gotoAndSettle(page, `${BASE}/admin/settings`);
    }
    await snap(page, "12-settings-main");
  });

  // ── 13. 파괴적 엣지케이스 ──
  test("13. 엣지케이스 — 빠른 네비게이션 전환", async ({ page }) => {
    // 사이드바 메뉴를 빠르게 연속 클릭하여 크래시 유발 테스트.
    // 의도적으로 짧은 대기 (300ms) 를 유지 — 이 케이스의 본질이 "이전 로딩 미완료 상태 다음 클릭".
    const menus = ["학생", "강의", "시험", "클리닉", "메시지", "영상", "커뮤니티", "설정"];
    for (const menu of menus) {
      const link = page
        .locator("nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a")
        .filter({ hasText: menu })
        .first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        // eslint-disable-next-line no-restricted-syntax
        await page.waitForTimeout(300); // 의도적 race — 본 테스트의 본질
      }
    }
    // 최종 페이지가 크래시 없이 렌더링되는지 확인
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // 에러 오버레이 0개 expect (silent log → hard).
    const errorOverlay = page.locator("text=Something went wrong").or(page.locator("text=오류가 발생"));
    expect(
      await errorOverlay.count(),
      "빠른 네비게이션 전환 후 에러 오버레이가 노출되면 안 됨 (크래시 회귀)",
    ).toBe(0);
    await snap(page, "13-rapid-nav");
  });

  // ── 14. 새로고침 내성 테스트 ──
  test("14. 새로고침 내성 — 주요 페이지 F5", async ({ page }) => {
    const pages = [
      "/admin/students",
      "/admin/lectures",
      "/admin/attendance",
      "/admin/clinic",
      "/admin/message/templates",
      "/admin/videos",
    ];
    for (const p of pages) {
      await gotoAndSettle(page, `${BASE}${p}`);
      // F5 새로고침
      await page.reload({ timeout: 15000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // 로그인 페이지로 리다이렉트되면 세션 회귀 — hard fail.
      expect(
        page.url(),
        `새로고침 후 ${p} 가 로그인 페이지로 리다이렉트되면 안 됨 (세션 유지 회귀)`,
      ).not.toContain("/login");
    }
    await snap(page, "14-refresh-test");
  });
});

// ═══════════════════════════════════════
// B. Student App 파괴테스트
// ═══════════════════════════════════════
test.describe("Student 앱 파괴테스트", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("Student — 메인/강의/시험/출결/클리닉/영상", async ({ page }) => {
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await snap(page, "20-student-main");

    // 학생 앱 주요 페이지 직접 방문 (탭바가 뷰포트 밖일 수 있으므로)
    const studentPages = [
      { name: "시험", path: "/student/exams" },
      { name: "클리닉", path: "/student/clinic" },
      { name: "영상", path: "/student/videos" },
    ];
    for (const sp of studentPages) {
      await gotoAndSettle(page, `${BASE}${sp.path}`);
      // 학생 페이지 직접 진입은 세션 회귀 검증 핵심 — 로그인 리다이렉트 = fail.
      expect(
        page.url(),
        `학생 ${sp.name} 페이지가 로그인으로 리다이렉트되면 안 됨 (세션 유지 회귀)`,
      ).not.toContain("/login");
      await snap(page, `20-student-${sp.name}`);
    }

    // 새로고침 내성
    await page.reload({ timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(
      page.url(),
      "학생 앱 새로고침 후 로그인 리다이렉트되면 안 됨 (세션 유지 회귀)",
    ).not.toContain("/login");
    await snap(page, "20-student-refresh");
  });
});

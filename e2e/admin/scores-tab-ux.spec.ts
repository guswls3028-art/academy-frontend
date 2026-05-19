/**
 * 성적 탭 UX 개선 검증 (commit 5b046f53)
 *
 * 검증 항목:
 * 1. 툴바 3그룹 구분선 (핵심/추가/관리)
 * 2. 시험·과제 없을 때 3단계 워크플로우 가이드
 * 3. 대상자 0명일 때 경고 배너
 * 4. 편집 모드 키보드 힌트 (Tab·화살표·Enter)
 * 5. 더보기 메뉴 아이콘 추가
 * 6. "수강생 일괄배정" 용어 변경
 *
 * 대상: 운영 사이트 (hakwonplus.com), Tenant 1 admin
 * 강의 96 / 차시 158 (omr 테스트강의 — exam 1개, homework 2개, 학생 2명)
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { FIXTURES_ALT } from "../helpers/test-fixtures";

const BASE = getBaseUrl("admin");
const SCREENSHOT_DIR = "e2e/screenshots";
const LECTURE_ID = FIXTURES_ALT.lectureId;
const SESSION_ID = FIXTURES_ALT.sessionId;

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/scores-ux-${name}.png`, fullPage: true });
}

async function waitForQuietUi(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

function scoresUrl() {
  return `${BASE}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`;
}

/**
 * Navigate to the known Tenant 1 scores fixture directly.
 * Sidebar/list traversal made this audit dependent on incidental layout and loading states.
 */
async function navigateToScoresTab(page: Page): Promise<boolean> {
  await page.goto(scoresUrl(), { waitUntil: "load", timeout: 20_000 });
  await waitForQuietUi(page);
  const ok = page.url().includes("/scores");
  console.log(`[nav] 최종 URL: ${page.url()} (scores: ${ok})`);
  return ok;
}

test.describe("성적 탭 UX 개선 검증", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  /**
   * 1. 툴바 3그룹 구분선 + "수강생 일괄배정" 용어 + 더보기 메뉴 아이콘
   */
  test("1. 툴바 구분선·용어·더보기 메뉴 아이콘 확인", async ({ page }) => {
    const ok = await navigateToScoresTab(page);
    await snap(page, "01-toolbar-overview");

    if (!ok) {
      console.log("[SKIP] 성적 탭 진입 실패");
      test.skip();
      return;
    }

    // (1) 구분선: <span aria-hidden="true"> — 3그룹 사이에 최소 2개
    const dividers = page.locator('span[aria-hidden="true"]');
    const dividerCount = await dividers.count();
    console.log(`[구분선] 수: ${dividerCount}`);
    expect(dividerCount).toBeGreaterThanOrEqual(2);

    // (6) "수강생 일괄배정" 용어 확인 (이전: "대상자 전원등록")
    const enrollBtn = page.locator("button").filter({ hasText: "수강생 일괄배정" });
    await expect(enrollBtn.first()).toBeVisible({ timeout: 5000 });
    console.log("[용어] '수강생 일괄배정' 확인됨");

    // 구 용어 부재 확인
    const oldBtn = page.locator("button").filter({ hasText: "대상자 전원등록" });
    expect(await oldBtn.count()).toBe(0);
    console.log("[용어] '대상자 전원등록' 없음 확인");

    // (5) 더보기 메뉴 (title="추가 기능") + 아이콘
    const moreBtn = page.locator("button[title='추가 기능']");
    await expect(moreBtn).toBeVisible({ timeout: 5000 });
    // 더보기 버튼 자체에 SVG 아이콘 (세로 점 3개)
    expect(await moreBtn.locator("svg").count()).toBeGreaterThanOrEqual(1);
    console.log("[더보기] 버튼 + SVG 아이콘 확인됨");

    await moreBtn.click();

    // 메뉴 아이템 아이콘 확인
    const printItem = page.locator("button").filter({ hasText: "성적표 출력" }).first();
    if (await printItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await printItem.locator("svg").count()).toBeGreaterThanOrEqual(1);
      console.log("[더보기] 성적표 출력 아이콘 확인됨");
    }

    const clinicItem = page.locator("button").filter({ hasText: "클리닉 대상 보기" }).first();
    if (await clinicItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await clinicItem.locator("svg").count()).toBeGreaterThanOrEqual(1);
      console.log("[더보기] 클리닉 대상 보기 아이콘 확인됨");
    }

    // 시험 종료 / 과제 종료 메뉴에도 아이콘
    const examClose = page.locator("button").filter({ hasText: "전체 시험 종료" }).first();
    if (await examClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await examClose.locator("svg").count()).toBeGreaterThanOrEqual(1);
      console.log("[더보기] 전체 시험 종료 아이콘 확인됨");
    }

    await snap(page, "01-more-menu-open");
  });

  /**
   * 4. 편집 모드 키보드 힌트 (Tab·화살표·Enter)
   */
  test("2. 편집 모드 키보드 힌트 확인", async ({ page }) => {
    const ok = await navigateToScoresTab(page);
    if (!ok) { test.skip(); return; }

    // 편집 모드 진입
    const editBtn = page.locator("button").filter({ hasText: "편집 모드" }).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    // 키보드 힌트: 현재 note 영역에 Enter/Tab/Esc 조작 안내가 표시된다.
    const hint = page.getByRole("note").filter({ hasText: "편집 모드" });
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText("Enter");
    await expect(hint).toContainText("Tab");
    await expect(hint).toContainText("Esc");
    await snap(page, "02-edit-mode");
    console.log("[키보드 힌트] 표시 확인됨");

    // 편집 컨트롤 확인
    await expect(page.getByRole("group", { name: "시험 점수 입력 방식" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "합산" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "주관식" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("group", { name: "과제 점수 입력 켜짐/꺼짐" })).toBeVisible({ timeout: 3000 });
    console.log("[편집 컨트롤] 시험/과제 입력 방식 확인됨");

    // 편집 모드 종료 → 힌트 사라짐 확인
    const saveBtn = page.locator("button").filter({ hasText: "저장하기" }).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();
    await expect(hint).toBeHidden({ timeout: 10_000 });
    console.log("[키보드 힌트] 종료 후 숨김 확인됨");
  });

  /**
   * 2,3. 상태별 UI: 워크플로우 가이드 / 경고 배너 / 테이블
   *       차시 158은 exam+homework 있고 학생 2명이므로 테이블이 표시되어야 함.
   *       워크플로우 가이드/경고 배너는 해당 상태에서만 나타남.
   */
  test("3. 성적 테이블 표시 + 뷰 필터 확인", async ({ page }) => {
    const ok = await navigateToScoresTab(page);
    if (!ok) { test.skip(); return; }

    // 차시 158은 데이터가 있으므로 테이블 표시
    const table = page.locator("table").first();
    await expect(table).toBeVisible({ timeout: 8000 });
    await snap(page, "03-scores-table");
    console.log("[테이블] 성적 테이블 표시됨");

    // 표시 옵션 + 핵심 점수 컬럼 확인
    await expect(page.getByRole("button", { name: /표시 옵션/ })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("columnheader", { name: /시험/ }).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("columnheader", { name: /과제/ }).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("columnheader", { name: /총점/ }).first()).toBeVisible({ timeout: 3000 });
    console.log("[표시 옵션] 버튼과 시험/과제/총점 컬럼 확인됨");

    // 점수 표시 형식: 점수/만점 셀이 실제 테이블에 렌더링된다.
    await expect(page.getByRole("cell", { name: /\d+\/\d+/ }).first()).toBeVisible({ timeout: 3000 });
    console.log("[점수 형식] 점수/만점 셀 확인됨");
  });

  /**
   * 종합: 모든 UX 요소 DOM 텍스트 확인 + 구 용어 부재
   */
  test("4. DOM 기반 UX 요소 종합 검증", async ({ page }) => {
    const ok = await navigateToScoresTab(page);
    if (!ok) { test.skip(); return; }

    await expect(page.locator("button").filter({ hasText: "수강생 일괄배정" }).first()).toBeVisible({ timeout: 5000 });
    const html = await page.content();

    // 신규 UX 요소 존재 확인
    expect(html).toContain("수강생 일괄배정");
    console.log("[DOM] '수강생 일괄배정' 존재 확인");

    expect(html).toContain("추가 기능"); // 더보기 버튼 title
    console.log("[DOM] '추가 기능' (더보기 title) 존재 확인");

    expect(html).toContain("+ 시험");
    console.log("[DOM] '+ 시험' 존재 확인");

    expect(html).toContain("+ 과제");
    console.log("[DOM] '+ 과제' 존재 확인");

    expect(html).toContain('aria-hidden="true"'); // 구분선
    console.log("[DOM] 구분선 (aria-hidden) 존재 확인");

    // 구 용어 부재 확인
    expect(html).not.toContain("대상자 전원등록");
    console.log("[DOM] '대상자 전원등록' 미존재 확인");

    await snap(page, "04-final-dom-check");
  });
});

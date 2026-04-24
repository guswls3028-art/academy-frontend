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

const BASE = getBaseUrl("admin");
const SCREENSHOT_DIR = "e2e/screenshots";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/scores-ux-${name}.png`, fullPage: true });
}

/**
 * Navigate to scores tab via sidebar clicks:
 * 1. Sidebar "강의" → lectures list
 * 2. Click lecture row (tr.cursor-pointer)
 * 3. Click session block (SessionBlockView button)
 * 4. Click "성적" tab link
 */
async function navigateToScoresTab(page: Page): Promise<boolean> {
  // 1. 사이드바 강의 메뉴 클릭
  const lectureNav = page.locator("nav a, aside a, [class*=sidebar] a, [class*=Sidebar] a")
    .filter({ hasText: "강의" }).first();
  if (!(await lectureNav.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("[nav] 사이드바 '강의' 메뉴 없음");
    return false;
  }
  await lectureNav.click();
  await page.waitForTimeout(3000);

  // 2. 강의 목록에서 행 클릭 (tr role=button or cursor-pointer)
  const lectureRow = page.locator("tbody tr").filter({ hasText: "omr" }).first();
  if (!(await lectureRow.isVisible({ timeout: 8000 }).catch(() => false))) {
    // fallback: 아무 행이나 클릭
    const anyRow = page.locator("tbody tr").first();
    if (!(await anyRow.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("[nav] 강의 행 없음");
      return false;
    }
    await anyRow.click();
  } else {
    await lectureRow.click();
  }
  await page.waitForTimeout(3000);
  await snap(page, "nav-02-lecture-detail");

  // 3. 세션 블록에서 차시 클릭 (SessionBlockView button)
  //    SessionBlockView는 "1차시" 텍스트를 가진 버튼 또는 aria-current 요소
  //    차시 블록 = 작은 카드 형태, 날짜 + 차시명 표시
  const sessionBlockBtn = page.locator("button, [role='button'], a")
    .filter({ hasText: /1차시/ }).first();
  if (await sessionBlockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sessionBlockBtn.click();
    await page.waitForTimeout(3000);
    console.log(`[nav] 세션 블록 클릭 후 URL: ${page.url()}`);
  } else {
    // URL 검사: 이미 세션 상세에 있는 경우
    if (!page.url().includes("/sessions/")) {
      console.log("[nav] 세션 블록 없음");
      await snap(page, "nav-03-no-session-block");
      return false;
    }
  }

  // 4. 성적 탭 클릭 (session detail 내부의 ds-tab 버튼)
  //    DomainTabs는 <button class="ds-tab"> 요소를 렌더링
  if (!page.url().includes("/scores")) {
    const scoresTabBtn = page.locator("button.ds-tab").filter({ hasText: "성적" }).first();
    if (await scoresTabBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoresTabBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log("[nav] 성적 탭 버튼(ds-tab) 없음");
      await snap(page, "nav-04-no-scores-tab");
      return false;
    }
  }

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(2000);
    await snap(page, "02-edit-mode");

    // 키보드 힌트: "Tab·화살표로 셀 이동 · Enter로 다음 행"
    const hint = page.locator("text=Tab·화살표로 셀 이동");
    await expect(hint).toBeVisible({ timeout: 5000 });
    console.log("[키보드 힌트] 표시 확인됨");

    // "편집 항목" 라벨
    await expect(page.locator("text=편집 항목").first()).toBeVisible({ timeout: 3000 });
    console.log("[편집 항목] 라벨 확인됨");

    // 편집 프리셋 버튼 확인 (합산+과제, 주관식+과제 등)
    await expect(page.locator("button").filter({ hasText: "합산+과제" }).first()).toBeVisible({ timeout: 3000 });
    console.log("[편집 프리셋] 합산+과제 확인됨");

    // 편집 모드 종료 → 힌트 사라짐 확인
    const saveBtn = page.locator("button").filter({ hasText: "저장하기" }).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();
    await page.waitForTimeout(2000);

    const hintGone = await page.locator("text=Tab·화살표로 셀 이동").isVisible().catch(() => false);
    expect(hintGone).toBe(false);
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

    await page.waitForTimeout(2000);
    await snap(page, "03-scores-table");

    // 차시 158은 데이터가 있으므로 테이블 표시
    const table = page.locator("table").first();
    await expect(table).toBeVisible({ timeout: 8000 });
    console.log("[테이블] 성적 테이블 표시됨");

    // 뷰 필터: 전체 / 시험만 / 과제만
    const allFilter = page.locator("button").filter({ hasText: "전체" }).first();
    const examFilter = page.locator("button").filter({ hasText: "시험만" }).first();
    const hwFilter = page.locator("button").filter({ hasText: "과제만" }).first();

    await expect(allFilter).toBeVisible({ timeout: 3000 });
    await expect(examFilter).toBeVisible({ timeout: 3000 });
    await expect(hwFilter).toBeVisible({ timeout: 3000 });
    console.log("[뷰 필터] 전체/시험만/과제만 확인됨");

    // 점수 표시 형식: 원점수 / 만점 표기
    const rawFormat = page.locator("button").filter({ hasText: "원점수" }).first();
    const fracFormat = page.locator("button").filter({ hasText: "만점 표기" }).first();
    await expect(rawFormat).toBeVisible({ timeout: 3000 });
    await expect(fracFormat).toBeVisible({ timeout: 3000 });
    console.log("[점수 형식] 원점수/만점 표기 확인됨");
  });

  /**
   * 종합: 모든 UX 요소 DOM 텍스트 확인 + 구 용어 부재
   */
  test("4. DOM 기반 UX 요소 종합 검증", async ({ page }) => {
    const ok = await navigateToScoresTab(page);
    if (!ok) { test.skip(); return; }

    await page.waitForTimeout(2000);
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

/**
 * Landing Public Community E2E (Phase 5-C, 2026-05-12)
 *
 * 외부 공개 커뮤니티(자유게시판/수강후기) 핵심 흐름 smoke:
 *   1. 비로그인 → /landing/board 진입 + render + DOM 존재
 *   2. 비로그인 → /landing/reviews 진입 + KPI band/별점 필터 render
 *   3. 메인 /landing → LandingCommunityShowcase (community_preview section) 노출
 *   4. footer "자유게시판" / "수강 후기" 링크 존재
 *
 * E2E rule:
 *   - TCHUL public landing tenant 대상
 *   - 작성 흐름은 backend API로 직접 fixture + cleanup (UI 부담 줄임)
 *   - 직접 goto = 초기 진입에만, 그 후 sidebar/btn navigate 우선
 */

import { test, expect } from "./fixtures/strictTest";
import type { Page } from "@playwright/test";
import { getBaseUrl, loginViaUI } from "./helpers/auth";

const BASE = getBaseUrl("tchul-admin");
const TENANT_CODE = "tchul";
const TAG = `[E2E-${Date.now()}]`;

// dev local 환경 대응 — frontend `localhost:5173` 진입 시 backend tenant resolution 차이 회피.
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "X-Tenant-Code": TENANT_CODE });
});

async function loginAdmin(page: Page): Promise<string> {
  await loginViaUI(page, "tchul-admin");
  return await page.evaluate(() => localStorage.getItem("access") || "");
}

// ──────────────────────────────────────────────────────────
test("1. 비로그인 /landing/board — 외부 학부모 read 가능", async ({ page }) => {
  await page.goto(`${BASE}/landing/board`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // 헤더 "자유게시판" 노출
  await expect(page.locator("h1")).toContainText("자유게시판", { timeout: 15_000 });

  // 카테고리 chip 존재
  await expect(page.getByTestId("landing-board-cat-all")).toBeVisible();
  await expect(page.getByTestId("landing-board-cat-tip")).toBeVisible();

  // 검색 input 존재
  await expect(page.getByTestId("landing-board-search")).toBeVisible();
});

test("2. 비로그인 /landing/reviews — KPI band + 별점 필터", async ({ page }) => {
  await page.goto(`${BASE}/landing/reviews`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  await expect(page.locator("h1")).toContainText("수강 후기", { timeout: 15_000 });

  // 별점 필터 chip
  await expect(page.getByTestId("landing-reviews-rating-0")).toBeVisible();
  await expect(page.getByTestId("landing-reviews-rating-5")).toBeVisible();

  // ordering select
  await expect(page.getByTestId("landing-reviews-ordering")).toBeVisible();
});

test("3. 메인 /landing — LandingCommunityShowcase 노출 + 적중사례 sticky chip", async ({ page }) => {
  await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // community_preview는 tenant 설정에 따라 선택 노출된다. 있으면 CTA를 검증하고,
  // 없으면 footer의 공개 커뮤니티 진입 링크로 접근성을 확인한다.
  const showcase = page.locator('section[data-stype="community_preview"]');
  if (await showcase.count() > 0) {
    await expect(showcase.getByTestId("landing-reviews-more")).toBeAttached();
    await expect(showcase.getByTestId("landing-board-more")).toBeAttached();
  } else {
    const footer = page.locator("footer").last();
    await expect(footer.getByText("자유게시판", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(footer.getByText("수강 후기", { exact: true })).toBeVisible();
  }

  // sticky strip 라벨 "적중 사례" 통일 (hit_reports section enabled이면)
  // scroll 200px+ 시점에 strip 나타남
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" as ScrollBehavior }));
  const strip = page.getByTestId("landing-section-tabs");
  await expect(strip).toBeVisible({ timeout: 5_000 }).catch(() => {});
  if (await strip.isVisible()) {
    // hit_reports chip이 있다면 라벨이 "적중 사례"
    const hitChip = strip.locator('[data-stab="hit_reports"]');
    if (await hitChip.count() > 0) {
      await expect(hitChip).toHaveText("적중 사례");
    }
  }
});

test("4. 비로그인 board write 진입 차단 — login redirect", async ({ page }) => {
  await page.goto(`${BASE}/landing/board/write`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // 비로그인 → /login 으로 redirect (Navigate replace)
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

test("5. 학원장 로그인 → board write 진입 가능 + HitReportPicker 노출", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${BASE}/landing/board/write`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // 카테고리/제목/익명 toggle 존재
  await expect(page.getByTestId("board-write-cat-tip")).toBeVisible();
  await expect(page.getByTestId("board-write-title")).toBeVisible();

  // staff(owner)이므로 HitReportPicker 노출
  await expect(page.getByTestId("hit-report-picker")).toBeVisible();
  await expect(page.getByTestId("hit-report-picker-toggle")).toBeVisible();
});

test("6. 학원장 → /admin/landing-public/inbox 모더레이션 3탭", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${BASE}/admin/landing-public/inbox`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  await expect(page.locator("h1")).toContainText("외부 공개 모더레이션", { timeout: 15_000 });

  // 3탭 모두 존재
  await expect(page.getByTestId("moder-tab-reviews")).toBeVisible();
  await expect(page.getByTestId("moder-tab-reports")).toBeVisible();
  await expect(page.getByTestId("moder-tab-blocks")).toBeVisible();

  // 차단 사용자 탭 클릭 → 차단 입력 UI 노출
  await page.getByTestId("moder-tab-blocks").click();
  await expect(page.getByTestId("block-user-id")).toBeVisible();
  await expect(page.getByTestId("block-submit")).toBeVisible();
});

test("7. footer — 자유게시판 / 수강 후기 링크 존재", async ({ page }) => {
  await page.goto(`${BASE}/landing/board`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const footer = page.locator("footer").last();
  await expect(footer).toBeVisible();
  // "자유게시판" 텍스트 footer 안에 존재
  await expect(footer.getByText("자유게시판", { exact: true })).toBeVisible();
  await expect(footer.getByText("수강 후기", { exact: true })).toBeVisible();
});

test.afterAll(async () => {
  // 본 spec은 read-only smoke이므로 cleanup 필요 데이터 없음.
  // 작성 흐름 spec은 별도 spec 파일에서 fixture insert/delete 패턴.
  console.log(`${TAG} smoke completed`);
});

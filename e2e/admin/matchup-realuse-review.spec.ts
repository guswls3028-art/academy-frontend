/**
 * 운영 매치업 실사용 리뷰 — 화면별 동작/표시 확인.
 * 일회성 탐색 spec (정식 회귀에 포함하지 않음).
 *
 * 운영 변경 없는 read-only 검증 위주:
 *  - 상단 탭/액션바 구조
 *  - 시험지 vs 참고자료 분리 UI
 *  - 카테고리 그룹핑 / 워크박스 / 매치 매트릭스 visible
 *  - 빈 상태/실문서 상태 모두 그래스풀
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-realuse-2026-04-27");
fs.mkdirSync(SHOTS, { recursive: true });

test.describe("매치업 실사용 리뷰", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("상단 진입: 매치업 탭 구조와 시험지/참고자료 분리 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // 페이지 초기 스크린샷
    await page.screenshot({ path: path.join(SHOTS, "01-matchup-landing.png"), fullPage: true });

    // 탭/액션 영역 (시험지/참고자료 업로드 진입 + 매치 매트릭스 액션)
    const testUpload = page.locator("[data-testid='matchup-upload-button'], [data-testid='matchup-empty-test-btn']").first();
    const refUpload = page.locator("[data-testid='matchup-reference-upload-button'], [data-testid='matchup-empty-reference-btn']").first();
    await expect(testUpload).toBeVisible({ timeout: 10000 });
    await expect(refUpload).toBeVisible({ timeout: 10000 });

    // 카테고리 / 그룹핑 헤더 또는 시험지 섹션 라벨 (실문서가 있으면 그룹 표시)
    const categoryHeader = page.getByText(/카테고리|시험지|참고\s*자료/);
    const headerCount = await categoryHeader.count();
    console.log("[REVIEW] 카테고리/섹션 헤더 후보:", headerCount);
    expect(headerCount).toBeGreaterThan(0);

    // 워크박스 (우상단 작업박스 — workbox recovery 포함)
    const workbox = page.locator("[data-testid='matchup-workbox'], [data-testid='workbox-toggle'], [data-testid='matchup-progress-tray']").first();
    await page.screenshot({ path: path.join(SHOTS, "02-matchup-toolbar.png") });
    if (await workbox.count() > 0) {
      await expect(workbox).toBeVisible();
      console.log("[REVIEW] workbox 노출 OK");
    } else {
      console.log("[REVIEW] workbox 미노출 — 진행 중 작업이 없으면 숨김 가능");
    }
  });

  test("문서 목록: 시험지 vs 참고자료 분리 + 카테고리 표시 + 행 클릭 패널", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const docs = page.locator("[data-testid='matchup-doc-row']");
    const count = await docs.count();
    console.log("[REVIEW] 매치업 문서 행 수:", count);

    if (count === 0) {
      console.log("[REVIEW] 문서가 없어 빈 상태 검증만 진행");
      const emptyTest = page.locator("[data-testid='matchup-empty-test-btn']");
      const emptyRef = page.locator("[data-testid='matchup-empty-reference-btn']");
      await expect(emptyTest.or(emptyRef)).toBeVisible({ timeout: 8000 });
      await page.screenshot({ path: path.join(SHOTS, "03-empty-state.png"), fullPage: true });
      return;
    }

    // 시험지/참고자료 의도 뱃지 — 행마다 분리 표기 (서버 + 프론트 분리)
    const intentBadges = page.locator("[data-testid='matchup-doc-intent-badge'], [data-testid='matchup-intent-badge']");
    const badgeCount = await intentBadges.count();
    console.log("[REVIEW] 의도 뱃지 수:", badgeCount, "/ 문서:", count);

    // 첫 행 클릭 → 디테일/패널 열리는지
    await docs.first().click();
    await page.waitForTimeout(400);
    const drawer = page.locator("[data-testid='matchup-doc-drawer'], [role='dialog']").first();
    if (await drawer.count() > 0) {
      await expect(drawer).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, "04-doc-drawer.png"), fullPage: true });
      console.log("[REVIEW] 문서 패널 열림 OK");
    } else {
      console.log("[REVIEW] 문서 행 클릭 후 디테일 패널 없음 — 행 자체가 디테일 보기일 수 있음");
      await page.screenshot({ path: path.join(SHOTS, "04-doc-row-click.png"), fullPage: true });
    }
  });

  test("매치 매트릭스: 시험지 기준 매치 보기 진입 가능 + 행/열 구조", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const matrixEntry = page.locator(
      "[data-testid='matchup-matrix-entry'], [data-testid='matchup-cross-match-button'], button:has-text('매치 매트릭스'), button:has-text('교차 매치')",
    ).first();

    if (await matrixEntry.count() === 0) {
      console.log("[REVIEW] 매트릭스 진입 버튼이 메인 화면에 없음 — 시험지 행 클릭 후 진입할 수 있음. 데이터 의존이라 스킵.");
      test.skip(true, "매트릭스 진입 버튼 미노출 (실 데이터 부족)");
      return;
    }

    await matrixEntry.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, "05-match-matrix.png"), fullPage: true });

    const matrix = page.locator("[data-testid='matchup-matrix'], [data-testid='match-matrix'], table").first();
    await expect(matrix).toBeVisible({ timeout: 10000 });
    console.log("[REVIEW] 매트릭스 컴포넌트 노출 OK");
  });

  test("수동 크롭 모달 진입 (액션 버튼 → 모달 노출)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const cropEntry = page.locator(
      "[data-testid='matchup-manual-crop-button'], [data-testid='matchup-crop-modal-trigger'], button:has-text('수동 크롭'), button:has-text('수동 자르기'), button:has-text('수동 분할')",
    ).first();

    if (await cropEntry.count() === 0) {
      console.log("[REVIEW] 메인 화면 수동 크롭 버튼 없음 — 문서 패널 안에서만 진입할 수 있음. 데이터 의존이라 스킵.");
      test.skip(true, "수동 크롭 진입 버튼 미노출");
      return;
    }

    await cropEntry.click();
    await page.waitForTimeout(800);
    const modal = page.locator("[data-testid='matchup-crop-modal'], [role='dialog']:has-text('크롭'), [role='dialog']:has-text('자르기')").first();
    await expect(modal).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: path.join(SHOTS, "06-crop-modal.png"), fullPage: true });
    console.log("[REVIEW] 수동 크롭 모달 노출 OK");
  });
});

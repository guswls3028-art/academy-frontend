/**
 * /admin/results, /admin/videos — KPI 인박스 + 트리 토글 검증
 *
 * 2026-04-25 UI/UX 랜딩 감사에서 발견된 P2(슬롯 40·50)에 대한 회귀 가드.
 * - KPI 4개 그리드 표시
 * - 토글 버튼으로 기존 트리 모드 진입/복귀
 * - localStorage 모드 기억
 *
 * Tenant 1 (admin97 / koreaseoul97).
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("admin landings KPI inbox", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    // 기억 모드 초기화 — 매 테스트 KPI 모드부터 시작
    await page.evaluate(() => {
      try {
        localStorage.removeItem("admin.results.explorerMode");
        localStorage.removeItem("admin.videos.explorerMode");
      } catch {
        /* ignore */
      }
    });
  });

  test("results landing — KPI grid + tree toggle", async ({ page }) => {
    await page.goto(`${BASE}/admin/results`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // KPI 그리드 노출
    const kpiGrid = page.getByTestId("results-kpi-grid");
    await expect(kpiGrid).toBeVisible({ timeout: 15_000 });

    // KPI 4개
    await expect(kpiGrid.locator('[data-kpi="true"]')).toHaveCount(4);

    // 라벨 존재
    await expect(page.getByText("채점 대기", { exact: false })).toBeVisible();
    await expect(page.getByText("운영 강의", { exact: false })).toBeVisible();
    await expect(page.getByText("운영 중 시험", { exact: false })).toBeVisible();

    // 토글 버튼 → 트리 모드
    const toggle = page.getByTestId("results-mode-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("강의별 탐색");
    await toggle.click();

    // 트리 모드: 좌측 트리(강의·차시) 노출
    await expect(page.getByText("강의 · 차시", { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("results-mode-toggle")).toContainText("오늘의 작업");

    // 다시 토글 → KPI 복귀
    await page.getByTestId("results-mode-toggle").click();
    await expect(page.getByTestId("results-kpi-grid")).toBeVisible();

    // 새로고침 후에도 마지막 모드 기억 (KPI)
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.getByTestId("results-kpi-grid")).toBeVisible();
  });

  test("videos landing — KPI grid + tree toggle", async ({ page }) => {
    await page.goto(`${BASE}/admin/videos`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // KPI 그리드 노출
    const kpiGrid = page.getByTestId("videos-kpi-grid");
    await expect(kpiGrid).toBeVisible({ timeout: 15_000 });

    // KPI 4개
    await expect(kpiGrid.locator('[data-kpi="true"]')).toHaveCount(4);

    await expect(page.getByText("등록된 영상", { exact: false })).toBeVisible();
    await expect(page.getByText("인코딩 진행 중", { exact: false })).toBeVisible();
    await expect(page.getByText("재시도 필요", { exact: false })).toBeVisible();

    // 토글 → 트리 모드
    const toggle = page.getByTestId("videos-mode-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("폴더별 탐색");
    await toggle.click();

    // 트리 모드: 좌측 폴더 노출
    await expect(page.getByText("폴더", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("videos-mode-toggle")).toContainText("오늘의 작업");

    // 다시 토글 → KPI
    await page.getByTestId("videos-mode-toggle").click();
    await expect(page.getByTestId("videos-kpi-grid")).toBeVisible();
  });
});

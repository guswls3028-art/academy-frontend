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

    // KPI 라벨 — 그리드 내부로 한정
    await expect(kpiGrid.getByText("채점 대기", { exact: true })).toBeVisible();
    await expect(kpiGrid.getByText("운영 강의", { exact: true })).toBeVisible();
    await expect(kpiGrid.getByText("운영 중 시험", { exact: true })).toBeVisible();

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

  test("results landing — tree mode persists across reload", async ({ page }) => {
    await page.goto(`${BASE}/admin/results`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // KPI → tree 토글
    await page.getByTestId("results-mode-toggle").click();
    await expect(page.getByText("강의 · 차시", { exact: false })).toBeVisible({ timeout: 10_000 });

    // 새로고침 — 트리 모드가 유지되어야
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.getByText("강의 · 차시", { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("results-mode-toggle")).toContainText("오늘의 작업");
  });

  test("results landing — KPI shows fallback on API error", async ({ page }) => {
    // 백엔드 500 에러를 강제 — fallback "—" 렌더 확인
    await page.route("**/results/admin/landing-stats/**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "forced E2E error" }),
      });
    });

    await page.goto(`${BASE}/admin/results`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const kpiGrid = page.getByTestId("results-kpi-grid");
    await expect(kpiGrid).toBeVisible({ timeout: 15_000 });
    // 4개 KPI 모두 "—"
    const dashCount = await kpiGrid.locator('.kpi-value:has-text("—")').count();
    expect(dashCount).toBe(4);
  });

  test("results landing — KPI click navigates to submissions inbox", async ({ page }) => {
    await page.goto(`${BASE}/admin/results`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const kpiGrid = page.getByTestId("results-kpi-grid");
    await expect(kpiGrid).toBeVisible({ timeout: 15_000 });

    // 「채점 대기」KPI 클릭 → /admin/results/submissions
    await kpiGrid.locator('button[data-kpi="true"]').first().click();
    await page.waitForURL(/\/admin\/results\/submissions/, { timeout: 10_000 });
    expect(page.url()).toContain("/admin/results/submissions");
  });

  test("videos landing — KPI grid + tree toggle", async ({ page }) => {
    await page.goto(`${BASE}/admin/videos`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // KPI 그리드 노출
    const kpiGrid = page.getByTestId("videos-kpi-grid");
    await expect(kpiGrid).toBeVisible({ timeout: 15_000 });

    // KPI 4개
    await expect(kpiGrid.locator('[data-kpi="true"]')).toHaveCount(4);

    await expect(kpiGrid.getByText("등록된 영상", { exact: true })).toBeVisible();
    await expect(kpiGrid.getByText("인코딩 진행 중", { exact: true })).toBeVisible();
    await expect(kpiGrid.getByText("재시도 필요", { exact: true })).toBeVisible();

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

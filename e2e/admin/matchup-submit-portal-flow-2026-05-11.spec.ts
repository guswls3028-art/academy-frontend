/**
 * 매치업 submit = 게시 흐름 + 적중보고서 탭 포탈 widget (2026-05-11).
 *
 * 학원장 mental model 정정 (2026-05-11 P-1 실측):
 *  - submitted 보고서 0건 / 223 doc — submit routine 정착 부재
 *  - "어디다 올리느냐" 톡 → submit ↔ 학원 홈페이지 게시 단어/흐름 분리가 본질
 *  - submit = "학원 홈페이지에 게시" 의미 통합 (1인 학원 학원장 정합)
 *
 * 검증 (Tenant 1, read-only):
 *  1. /admin/hit-reports 진입 → 포탈 widget "🌐 우리 학원 매치업 게시판" 노출
 *  2. widget header 버튼 (새로고침 / 전체 보기) 노출
 *  3. 정정된 텍스트 노출 (필터 옵션 "홈페이지 게시 중" / banner 문구)
 *
 * 메모리 정책: feedback_no_e2e_on_real_tenants — Tenant 1 만, 박철T 등 실사용 X.
 */
import { expect, test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const SCREENSHOT_DIR = "e2e/_artifacts/matchup-submit-portal-2026-05-11";

test.describe("매치업 submit = 게시 통합 흐름 (1번 테넌트, read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("적중보고서 탭 — 포탈 widget 노출 + 정정 텍스트", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/hit-reports", {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-hit-reports-with-portal-widget.png`,
      fullPage: true,
    });

    // 포탈 widget 헤더 — "🌐 우리 학원 매치업 게시판" 텍스트 / "전체 보기" CTA
    await expect(page.getByText("우리 학원 매치업 게시판")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /전체 보기/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /새로고침/ }).first()).toBeVisible();

    // 필터 옵션 — "홈페이지 게시 중" (기존 "제출 완료" 정정)
    const statusSelect = page.locator("select").first();
    await expect(statusSelect).toBeVisible();
    const optionTexts = await statusSelect.locator("option").allInnerTexts();
    expect(optionTexts).toContain("작성 중");
    expect(optionTexts).toContain("홈페이지 게시 중");
    // 정정 검증 — 기존 "제출 완료" 단어 사라짐
    expect(optionTexts).not.toContain("제출 완료");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-filter-options-updated.png`,
      fullPage: false,
    });
  });

  test("draft 0건 + 게시 0건 빈 상태 안내 정합", async ({ page }) => {
    // T1 admin97 가 매치업 자료를 쓰지 않는 환경이면 empty state 정합 확인
    await page.goto("https://hakwonplus.com/admin/hit-reports?mine=1", {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1500);

    // empty state 또는 카드 list 둘 중 하나 노출.
    // 카드가 없을 때 표시되는 "학원 홈페이지에 게시된 보고서가 없습니다" 텍스트 또는
    // "작성한 보고서가 없습니다" 텍스트. (T1 학원장 위주 사용 가정 X)
    const emptyText = page.getByText(/보고서가 없습니다/);
    const cardArea = page.locator("[data-testid='hit-report-card']").first();
    await expect(emptyText.or(cardArea)).toBeVisible({ timeout: 10_000 });

    // 정정 검증 — 어떤 empty 메시지든 "학원에 제출된" 단어 없어야 함
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("학원에 제출된 보고서가 없습니다");
    // 게시 단어가 노출되어야 함 (filter option / widget header / banner 중 하나)
    expect(bodyText).toMatch(/홈페이지.*게시|매치업 게시판/);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-empty-state-with-publish-wording.png`,
      fullPage: true,
    });
  });

  test("포탈 widget 새로고침 버튼 클릭 → API 호출", async ({ page }) => {
    let boardPreviewCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/matchup/hit-reports/board-preview/")) {
        boardPreviewCalled = true;
      }
    });

    await page.goto("https://hakwonplus.com/admin/hit-reports", {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1500);

    // 초기 fetch 1회 이미 발사됨 — 신호 reset 후 새로고침 클릭으로 재호출 확인
    boardPreviewCalled = false;
    const refreshBtn = page.getByRole("button", { name: /새로고침/ }).first();
    await refreshBtn.click();
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1500);

    expect(boardPreviewCalled).toBe(true);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-after-refresh.png`,
      fullPage: false,
    });
  });
});

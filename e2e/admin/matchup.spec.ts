/**
 * E2E: 매치업 기능 — 사이드바 자료실 → 매치업 탭 → UI 검증
 * Tenant 1 (hakwonplus), [E2E-{timestamp}] 태그
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const TAG = `[E2E-${Date.now()}]`;

test.describe("매치업 기능", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("사이드바 '자료실' 클릭 → 매치업 탭으로 이동", async ({ page }) => {
    // 사이드바에서 '자료실' 클릭
    const navItem = page.locator("nav").getByText("자료실");
    await expect(navItem).toBeVisible({ timeout: 10000 });
    await navItem.click();

    // 매치업 탭이 활성화되어 있어야 함
    await expect(page).toHaveURL(/\/admin\/storage\/matchup/, { timeout: 10000 });

    // 빈 상태 CTA 표시 확인
    await expect(page.getByText("AI 매치업")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("문서 업로드")).toBeVisible();
  });

  test("저장소 탭 클릭 → 기존 저장소 기능 정상", async ({ page }) => {
    await page.goto(page.url().replace(/\/admin\/.*/, "/admin/storage/matchup"), {
      waitUntil: "load",
    });

    // 저장소 탭 클릭
    const storageTab = page.getByRole("link", { name: "저장소" }).or(
      page.locator("[data-tab-key='files']"),
    );
    // DomainTabs에서 저장소 탭 찾기
    const tab = page.locator("a, button").filter({ hasText: "저장소" }).first();
    await tab.click();

    await expect(page).toHaveURL(/\/admin\/storage\/files/, { timeout: 10000 });
  });

  test("업로드 모달 열기/닫기", async ({ page }) => {
    await page.goto(page.url().replace(/\/admin\/.*/, "/admin/storage/matchup"), {
      waitUntil: "load",
    });

    // 빈 상태에서 '문서 업로드' 버튼 클릭
    await page.getByText("문서 업로드").click();

    // 모달 표시 확인
    await expect(page.getByText("PDF, PNG, JPG 파일을 선택하세요")).toBeVisible({ timeout: 3000 });

    // 취소 버튼으로 닫기
    await page.getByText("취소").click();

    // 모달 사라짐 확인
    await expect(page.getByText("PDF, PNG, JPG 파일을 선택하세요")).not.toBeVisible();
  });

  test("탭 전환: 매치업 ↔ 저장소", async ({ page }) => {
    // 자료실로 이동
    const navItem = page.locator("nav").getByText("자료실");
    await navItem.click();
    await expect(page).toHaveURL(/\/admin\/storage\/matchup/, { timeout: 10000 });

    // 저장소 탭 클릭
    const storageTab = page.locator("a, button").filter({ hasText: "저장소" }).first();
    await storageTab.click();
    await expect(page).toHaveURL(/\/admin\/storage\/files/, { timeout: 10000 });

    // 다시 매치업 탭
    const matchupTab = page.locator("a, button").filter({ hasText: "매치업" }).first();
    await matchupTab.click();
    await expect(page).toHaveURL(/\/admin\/storage\/matchup/, { timeout: 10000 });
  });
});

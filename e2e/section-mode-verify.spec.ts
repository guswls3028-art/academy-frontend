/**
 * Section Mode SSOT Verification
 * 검증 대상: 설정 > 내 정보 모드 표시, 개발자 콘솔 운영 설정, 반 편성 라우트
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("Section Mode SSOT", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("설정 > 내 정보에 운영 모드가 표시된다", async ({ page }) => {
    await page.goto(`${BASE}/admin/settings/profile`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 운영 모드 섹션이 보이는지 확인
    const modeSection = page.locator("text=운영 모드");
    await expect(modeSection).toBeVisible({ timeout: 10000 });

    // 반 편성, 학생 대상, 클리닉 라벨이 보이는지
    await expect(page.locator("text=반 편성")).toBeVisible();
    await expect(page.locator("text=학생 대상")).toBeVisible();
    // "클리닉" 라벨이 운영 모드 섹션 내에 표시되는지 (사이드바 메뉴와 구분)
    await expect(page.locator("text=정규형 (필수 클리닉)").or(page.locator("text=보충형 (불합격 관리)"))).toBeVisible();
  });

  test("개발자 콘솔 > 운영 설정 탭이 존재한다", async ({ page }) => {
    await page.goto(`${BASE}/admin/developer/flags`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 운영 모드 설정 가이드가 보이는지
    const guide = page.locator("text=운영 모드 설정");
    await expect(guide).toBeVisible({ timeout: 10000 });

    // 3가지 모드 카드가 보이는지
    await expect(page.locator("text=반 편성 모드")).toBeVisible();
    await expect(page.locator("text=학생 대상 (학령)")).toBeVisible();
    await expect(page.locator("text=클리닉 모드")).toBeVisible();

    // 현재 적용 중 섹션
    await expect(page.locator("text=현재 적용 중")).toBeVisible();
  });

  test("강의 상세에서 반 편성 라우트가 접근 가능하다", async ({ page }) => {
    // 강의 목록으로 이동
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 강의 클릭 (있다면)
    const firstLecture = page.locator('a[href*="/admin/lectures/"]').first();
    if (await firstLecture.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await firstLecture.getAttribute("href");
      if (href) {
        // sections 라우트로 직접 이동
        const sectionsUrl = `${BASE}${href}/sections`;
        await page.goto(sectionsUrl, { waitUntil: "load" });
        await page.waitForTimeout(2000);
        // 페이지가 에러 없이 로드되는지 확인 (빈 상태라도 OK)
        const errorText = page.locator("text=잘못된 강의 ID");
        const isError = await errorText.isVisible({ timeout: 3000 }).catch(() => false);
        expect(isError).toBe(false);
      }
    }
  });
});

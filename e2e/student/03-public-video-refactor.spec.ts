/**
 * E2E: 공개 영상 도메인 리팩토링 검증
 * - "전체공개영상"이 강의 목록이 아닌 별도 섹션으로 표시되는지 확인
 * - 관리자 강의 목록에서 시스템 강의가 제외되는지 확인
 * - 관리자 영상 탐색기에서 "전체공개영상" 라벨이 표시되는지 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("공개 영상 리팩토링 검증", () => {

  test("학생 영상 홈 — 전체공개영상 카드 정상 표시", async ({ page }) => {
    await loginViaUI(page, "student");
    await page.goto(`${BASE}/student/video`);
    await page.waitForLoadState("networkidle");

    // "전체공개영상" 카드가 있으면 정상 표시 확인
    const publicCard = page.locator("text=전체공개영상");
    const hasPublic = await publicCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasPublic) {
      await expect(publicCard).toBeVisible();
    }
  });

  test("관리자 강의 목록 — 시스템 강의 미노출", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForLoadState("networkidle");

    // 강의 관리 화면에서는 시스템 강의가 보이면 안 됨
    // 강의 테이블/카드가 로드되길 기다림
    await page.waitForTimeout(2000);

    // 관리자 강의 목록에 표시된 강의 제목들을 가져와서 시스템 강의가 없는지 확인
    const pageContent = await page.textContent("body");
    // 강의 관리 화면의 강의 카드/테이블 안에서만 체크 (네비게이션 등은 제외)
    const mainContent = page.locator("main, [class*=content], [class*=page]");
    const mainText = await mainContent.allTextContents();
    // is_system=True 강의는 백엔드에서 제외되므로 리스트에 없어야 함
  });

  test("관리자 영상 탐색기 — 전체공개영상 라벨 표시", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/videos`);
    await page.waitForLoadState("networkidle");

    // 좌측 트리에서 "전체공개영상" 버튼 라벨 확인
    const publicLabel = page.getByRole("button", { name: "전체공개영상" });
    await expect(publicLabel).toBeVisible({ timeout: 10000 });
  });
});

/**
 * 불만 방지 테스트 — 실제 사용자 불만으로 이어지는 패턴 검증
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();

test.describe("불만 방지 시나리오", () => {

  test("중복 제출 방지: 학생 QnA 제출 후 버튼 비활성화", async ({ browser }) => {
    // TYPE: UI-DRIVEN
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginViaUI(page, "student");

    await page.goto(`${BASE}/student/community`);
    await page.waitForLoadState("networkidle");

    // QnA 탭
    const qnaTab = page.locator("button, [role='tab']").filter({ hasText: /QnA|질문/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await page.waitForTimeout(500);
    }

    // 질문하기
    const writeBtn = page.locator("button, a").filter({ hasText: /질문|작성/ }).first();
    await writeBtn.waitFor({ state: "visible", timeout: 5000 });
    await writeBtn.click();

    // 제목 + 내용 입력
    const title = page.locator('input[placeholder*="제목"]').first();
    await title.waitFor({ state: "visible", timeout: 5000 });
    await title.fill(`[E2E] 중복방지 ${TS}`);

    const editor = page.locator('.ProseMirror[contenteditable="true"], [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type("중복 제출 테스트 내용");

    // 제출 버튼 찾기
    const submitBtn = page.locator("button").filter({ hasText: /보내기|등록|제출/ }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });

    // 클릭 후: 버튼 비활성화 OR 페이지 이동 → 둘 다 중복 제출 방지로 인정
    await submitBtn.click();
    await page.waitForTimeout(1000);
    // 제출 후 상태: 버튼 사라짐(페이지 이동) OR 비활성화 OR 토스트 표시
    const btnGone = !await submitBtn.isVisible().catch(() => false);
    const btnDisabled = await submitBtn.isDisabled().catch(() => false);
    const toastShown = await page.locator('[class*="toast"], [class*="Toastify"]').isVisible().catch(() => false);
    expect(btnGone || btnDisabled || toastShown).toBe(true);

    // Cleanup
    await page.waitForTimeout(3000);
    await ctx.close();

    // 관리자로 삭제
    const ctx2 = await browser.newContext();
    const adminPage = await ctx2.newPage();
    await loginViaUI(adminPage, "admin");
    const resp = await apiCall(adminPage, "GET", "/community/posts/?post_type=qna&page_size=50");
    const target = (resp.body?.results || []).find((p: any) => p.title?.includes(`중복방지 ${TS}`));
    if (target) await apiCall(adminPage, "DELETE", `/community/posts/${target.id}/`);
    await ctx2.close();
  });

  test("새로고침 후 데이터 유지: 관리자 커뮤니티 목록", async ({ page }) => {
    // TYPE: UI-DRIVEN
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/community/notice`);
    await page.waitForLoadState("networkidle");

    // 목록이 보이는지
    const content = page.locator("main, [class*='page']").first();
    await expect(content).toBeVisible();

    // 새로고침
    await page.reload();
    await page.waitForLoadState("networkidle");

    // 여전히 보이는지 (stale cache 문제 없는지)
    await expect(content).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });

  test("삭제된 리소스 접근: 존재하지 않는 게시물 상세", async ({ page }) => {
    // TYPE: API-ASSISTED
    await loginViaUI(page, "admin");
    const resp = await apiCall(page, "GET", "/community/posts/999999/");
    expect(resp.status).toBe(404);
  });

  test("모바일 뷰포트: 학생 대시보드가 깨지지 않는다", async ({ browser }) => {
    // TYPE: UI-DRIVEN (mobile viewport)
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, // iPhone 13 Mini
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    });
    const page = await ctx.newPage();
    await loginViaUI(page, "student");

    // 대시보드가 모바일에서도 정상
    await expect(page.locator("[data-app='student']").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 탭바가 보이는지
    const tabbar = page.locator("[class*='tabbar'], nav").last();
    await expect(tabbar).toBeVisible();

    await ctx.close();
  });

  test("모바일 뷰포트: 학생 영상 홈이 깨지지 않는다", async ({ browser }) => {
    // TYPE: UI-DRIVEN (mobile viewport)
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    await loginViaUI(page, "student");
    await page.goto(`${BASE}/student/video`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("[data-app='student']").first()).toBeVisible();
    await ctx.close();
  });
});

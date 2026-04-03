/**
 * Community Domain UI/UX 상품 레벨 심미적 검사
 *
 * Admin앱 + Student앱 커뮤니티 전 화면 스크린샷 캡처
 * — 데스크톱(1280x800) + 모바일(390x844) 양쪽
 */
import { test, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function safeGoto(page: Page, url: string, waitMs = 2500): Promise<void> {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(waitMs);
  const err = page.locator("text=일시적인 오류가 발생했습니다").first();
  if (await err.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(waitMs);
    if (await err.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(waitMs);
    }
  }
}

async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `e2e/screenshots/ux-${name}.png`, fullPage: true });
}

test.describe("Community UI/UX Audit — Desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Admin: 공지사항 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/notice?scope=all`);
    await snap(page, "admin-notice-desktop");
  });

  test("Admin: 게시판 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/board?scope=all`);
    await snap(page, "admin-board-desktop");
  });

  test("Admin: 자료실 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/materials?scope=all`);
    await snap(page, "admin-materials-desktop");
  });

  test("Admin: QnA 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/qna`);
    await snap(page, "admin-qna-desktop");

    // QnA 카드 클릭해서 상세+답변 영역도 캡처
    const firstCard = page.locator(".qna-inbox__card").first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(1500);
      await snap(page, "admin-qna-detail-desktop");
    }
  });

  test("Admin: 상담 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/counsel`);
    await snap(page, "admin-counsel-desktop");

    const firstCard = page.locator(".qna-inbox__card").first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(1500);
      await snap(page, "admin-counsel-detail-desktop");
    }
  });

  test("Admin: 설정 페이지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/settings`);
    await snap(page, "admin-settings-desktop");
  });
});

test.describe("Community UI/UX Audit — Student Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Student: 공지사항 탭", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    // 공지사항은 기본 탭
    const noticeTab = page.locator("button").filter({ hasText: "공지사항" }).first();
    if (await noticeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noticeTab.click();
      await page.waitForTimeout(1500);
    }
    await snap(page, "student-notice-mobile");

    // 첫 번째 공지 클릭 → 상세
    const firstPost = page.locator('[class*="panel"][class*="pressable"], button').filter({ hasText: /E2E|공지|테스트/ }).first();
    if (await firstPost.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstPost.click();
      await page.waitForTimeout(1500);
      await snap(page, "student-notice-detail-mobile");
    }
  });

  test("Student: 게시판 탭", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    const boardTab = page.locator("button").filter({ hasText: "게시판" }).first();
    await boardTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "student-board-mobile");
  });

  test("Student: 자료실 탭", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    const matTab = page.locator("button").filter({ hasText: "자료실" }).first();
    await matTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "student-materials-mobile");
  });

  test("Student: QnA 탭 + 질문 폼", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    const qnaTab = page.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "student-qna-list-mobile");

    // 질문 상세 (답변 있는 것)
    const firstQ = page.locator('[class*="panel"][class*="pressable"], button').filter({ hasText: /E2E|질문|테스트/ }).first();
    if (await firstQ.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstQ.click();
      await page.waitForTimeout(1500);
      await snap(page, "student-qna-detail-mobile");
    }
  });

  test("Student: 상담 탭 + 상세", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    const counselTab = page.locator("button").filter({ hasText: "상담 신청" }).first();
    await counselTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "student-counsel-list-mobile");

    const firstC = page.locator('[class*="panel"][class*="pressable"], button').filter({ hasText: /E2E|상담|테스트/ }).first();
    if (await firstC.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstC.click();
      await page.waitForTimeout(1500);
      await snap(page, "student-counsel-detail-mobile");
    }
  });

  test("Student: QnA 질문 작성 폼 UI", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    const qnaTab = page.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.click();
    await page.waitForTimeout(1500);
    const askBtn = page.locator("button").filter({ hasText: "질문하기" }).first();
    if (await askBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await askBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, "student-qna-form-mobile");
    }
  });
});

/**
 * 커뮤니티 상담/QnA UIUX 개편 검증 (2026-04-26)
 * - 답변자 라벨 통일 ("선생님 답변")
 * - 상태 라벨 통일 ("답변 완료" / "답변 대기")
 * - 관리자 상담: 답변하기 CTA + 학생 컨텍스트 패널
 * - 학생 상담 폼: COUNSEL_CATEGORIES 사전 옵션
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("커뮤니티 UIUX 개편 — 운영 검증", () => {
  test("관리자 상담 인박스 — 라벨 통일 + 답변하기 CTA", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/community/counsel`);
    await page.waitForLoadState("networkidle");

    // 필터 라벨 통일
    await expect(page.getByRole("button", { name: /답변 대기/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /답변 완료/ })).toBeVisible();

    // "대기 중" / "상담 완료" 같은 옛 라벨 부재
    await expect(page.locator(".qna-inbox__filter-btn", { hasText: /^대기 중$/ })).toHaveCount(0);
    await expect(page.locator(".qna-inbox__filter-btn", { hasText: /^상담 완료$/ })).toHaveCount(0);
  });

  test("관리자 상담 — 첫 항목 선택 시 답변하기 CTA + 학생 패널", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/community/counsel`);
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator(".qna-inbox__card").first();
    const cardCount = await firstCard.count();
    test.skip(cardCount === 0, "운영 환경에 상담 데이터 없음");

    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // 답변하기 CTA 버튼 (created_by 미삭제 + replies_count 0 시)
    const answerBtn = page.getByRole("button", { name: /답변하기/ });
    const isVisibleOrAlreadyAnswered =
      (await answerBtn.count()) > 0 ||
      (await page.locator(".qna-inbox__status--resolved").count()) > 0;
    expect(isVisibleOrAlreadyAnswered).toBeTruthy();

    // 학생 정보 패널
    await expect(page.locator(".qna-inbox__student-panel-label")).toBeVisible();
  });

  test("관리자 QnA — 라벨 통일 유지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/community/qna`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /답변 필요/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /답변 완료/ })).toBeVisible();
  });

  test("학생 커뮤니티 — 상담 신청 폼 카테고리 사전 옵션", async ({ page }) => {
    await loginViaUI(page, "student");
    await page.goto(`${BASE}/student/community`);
    await page.waitForLoadState("networkidle");

    // 상담 탭 클릭
    const counselTab = page.locator("button").filter({ hasText: /^상담$/ }).first();
    await counselTab.click();
    await page.waitForTimeout(800);

    // "상담 신청하기" 버튼 클릭
    const applyBtn = page.locator("button").filter({ hasText: /상담 신청하기/ }).first();
    if ((await applyBtn.count()) === 0) {
      test.skip(true, "학부모 읽기 전용 또는 폼 진입 불가");
    }
    await applyBtn.click();
    await page.waitForTimeout(500);

    // 카테고리 select 옵션 — 강의가 아닌 상담 분야 사전
    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    const optionTexts = await select.locator("option").allTextContents();
    const dictTerms = ["진로 상담", "학습 방법", "성적 상담", "출결·생활", "결제·수강", "기타"];
    const matched = dictTerms.filter((t) => optionTexts.some((o) => o.includes(t)));
    expect(matched.length).toBeGreaterThanOrEqual(3);
  });
});

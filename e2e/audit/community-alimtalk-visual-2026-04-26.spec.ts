/**
 * 커뮤니티 답변 알림톡 — 실사용 검증 (스크린샷 + API)
 *
 * 검증 목표:
 *  1) admin /message/auto-send 페이지의 "커뮤니티" 섹션에 신규 카드 2장 노출
 *     - qna_answered ("QnA 답변이 등록되면…")
 *     - counsel_answered ("상담 답변이 등록되면…")
 *  2) AutoSendConfig API에서 두 trigger가 provisioned 되어 있는지(default enabled=False)
 *  3) trigger 카드 본문/토글 시각 확인 (스크린샷)
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import path from "node:path";

const BASE = getBaseUrl("admin");
const SHOT_DIR = path.join(process.cwd(), "_e2e_review_screenshots", "community-alimtalk");

test.describe("커뮤니티 알림톡 실사용 검증", () => {
  test("1. admin 자동발송 페이지에 qna_answered / counsel_answered 카드 노출", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/message/auto-send`);
    await page.waitForLoadState("networkidle");
    // 데이터 로딩 + provisioning 대기
    await page.waitForTimeout(2000);

    // 페이지 전체 스크린샷 (진입 직후 — 가입/등록 기본 카테고리)
    await page.screenshot({ path: path.join(SHOT_DIR, "01-page-default-category.png"), fullPage: true });

    // 자동발송 페이지 안 카테고리 트리(`구간` 헤더 하단의 nav)에서 "커뮤니티" 클릭
    // admin 사이드바에도 "커뮤니티" 메뉴가 있어 .last()로 카테고리 트리 항목 선택
    const communityNav = page.getByRole("button", { name: "커뮤니티" }).last();
    await expect(communityNav, "카테고리 트리 커뮤니티").toBeVisible({ timeout: 10_000 });
    await communityNav.click();
    await page.waitForTimeout(1500);

    // 진입 후 전체 스크린샷
    await page.screenshot({ path: path.join(SHOT_DIR, "02-community-section.png"), fullPage: true });

    // qna_answered 카드 (description 텍스트로 매칭)
    const qnaCard = page.locator("text=/QnA 답변이 등록되면/").first();
    await expect(qnaCard).toBeVisible({ timeout: 10_000 });

    // counsel_answered 카드
    const counselCard = page.locator("text=/상담 답변이 등록되면/").first();
    await expect(counselCard).toBeVisible({ timeout: 10_000 });

    // qna_answered 카드 클로즈업
    await qnaCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "03-qna-card-closeup.png") });

    // counsel_answered 카드 클로즈업
    await counselCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "04-counsel-card-closeup.png") });
  });

  test("2. AutoSendConfig API에 신규 trigger 2종 provisioned + default enabled=false", async ({ page }) => {
    await loginViaUI(page, "admin");

    // provision 트리거 — auto-send 페이지 1회 진입
    await page.goto(`${BASE}/admin/message/auto-send`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const resp = await apiCall(page, "GET", "/messaging/auto-send/");
    expect(resp.status, "auto-send 목록 조회").toBe(200);

    // 응답이 array 또는 {results: array}
    const list = Array.isArray(resp.body)
      ? resp.body
      : Array.isArray(resp.body?.results)
        ? resp.body.results
        : [];
    expect(list.length, "configs 1건 이상").toBeGreaterThan(0);

    const triggers = list.map((c: { trigger?: string }) => c.trigger);
    expect(triggers, "qna_answered provisioned").toContain("qna_answered");
    expect(triggers, "counsel_answered provisioned").toContain("counsel_answered");

    const qnaCfg = list.find((c: { trigger?: string }) => c.trigger === "qna_answered");
    const counselCfg = list.find((c: { trigger?: string }) => c.trigger === "counsel_answered");
    expect(qnaCfg?.enabled, "qna default OFF").toBeFalsy();
    expect(counselCfg?.enabled, "counsel default OFF").toBeFalsy();
  });
});

/** 숨은 비즈니스 모순 회귀 — API 정책과 화면 문구가 어긋나지 않는지 확인한다. */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("알림톡 숨은 모순", () => {
  test.beforeEach(async ({ page }) => loginViaUI(page, "admin"));

  test("결제 승인 양식이 없으면 사용 가능으로 가장하지 않는다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/templates`);
    await page.getByText("결제", { exact: true }).first().click();

    const content = page.locator("main");
    await expect(content).toContainText(/결제/);
    const paymentCards = content.locator("[class*=contentCard]");
    const count = await paymentCards.count();
    for (let i = 0; i < count; i += 1) {
      const text = await paymentCards.nth(i).innerText();
      if (text.includes("결제")) {
        expect(!(text.includes("발송 준비 필요") && text.includes("알림톡 준비됨"))).toBeTruthy();
      }
    }
  });

  test("가입 자동발송은 승인 전용 양식과 발송 가능 상태를 일관되게 표시한다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/auto-send`);
    const signupCard = page.locator("[data-card-state]").filter({ hasText: "가입 안내(학생)" }).first();
    await expect(signupCard).toBeVisible();
    const text = await signupCard.innerText();
    if (text.includes("사용 가능")) {
      expect(text).toContain("승인된 전용 알림톡");
      expect(text).not.toContain("아직 자동 발송하지 않음");
    }
  });

  test("설정 API 변경 UI와 공급사 템플릿 생성 UI가 다시 생기지 않는다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/settings`);
    await expect(page.getByRole("textbox", { name: /PFID|API|발신번호/ })).toHaveCount(0);
    await gotoAndSettle(page, `${BASE}/admin/message/templates`);
    await expect(page.getByRole("button", { name: /검수 신청|솔라피 동기화/ })).toHaveCount(0);
  });
});

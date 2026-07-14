/** 알림톡 전용 상품 계약 — 설정·문구·자동발송 UI가 같은 정책을 말하는지 검증한다. */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("메시징 비즈니스 계약", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("설정은 공용 알림톡 상태만 보여주고 테넌트별 공급자·키 편집을 노출하지 않는다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/settings`);

    await expect(page.getByText("공용 솔라피", { exact: true })).toBeVisible();
    await expect(page.getByText("알림톡 전용", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "알림톡 연동 테스트" })).toBeVisible();
    await expect(page.getByText(/API Key|API Secret|뿌리오|개별 채널/)).toHaveCount(0);
    await expect(page.getByText(/공용 PFID|현재 PFID/)).toHaveCount(0);
  });

  test("문구 화면은 문구와 승인 알림톡 상태를 구분하고 공급사 동기화를 노출하지 않는다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/templates`);

    await expect(page.getByRole("heading", { name: "문구 저장" })).toBeVisible();
    await expect(page.getByText(/알림톡에 넣을 문구를 저장하고 수정합니다/)).toBeVisible();
    await expect(page.getByRole("button", { name: /동기화|검수 신청/ })).toHaveCount(0);
    await expect(page.getByText(/SMS|LMS/)).toHaveCount(0);
  });

  test("자동발송 카드에서 발송 준비 필요와 항상 활성이 동시에 표시되지 않는다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/message/auto-send`);

    const cards = page.locator("[data-card-state]");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i += 1) {
      const text = await cards.nth(i).innerText();
      expect(!(text.includes("발송 준비 필요") && text.includes("항상 활성"))).toBeTruthy();
    }
    await expect(page.getByText(/SMS|LMS/)).toHaveCount(0);
  });
});
